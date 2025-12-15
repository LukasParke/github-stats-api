import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, mkdirSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env";
import { uploadImage, getImageKey, getPublicUrl } from "./storage";
import type { UserStats } from "./github";
import { webpackOverride } from "../../../remotion/src/webpack-override";
import { getSharedRemotionBrowser } from "./remotion-browser";
import { convertVideoToWebP } from "./ffmpeg";

// Get current directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the Remotion package
// In the container image the monorepo lives at /app and packages are under /app/packages/*
// This file is at /app/packages/server/src/services, so ../../../remotion resolves to /app/packages/remotion
const REMOTION_PKG = join(__dirname, "../../../remotion");
const REMOTION_ENTRY = join(REMOTION_PKG, "src/index.ts");
export const TEMP_DIR = join(__dirname, "../../temp");
const PREBUNDLED_BUNDLE_DIR = join(__dirname, "../../remotion-bundle");

// Cached bundle path
let bundlePath: string | null = null;

// Available compositions
export const COMPOSITIONS = [
  "readme-dark-gemini",
  "readme-light-gemini",
  "readme-dark-waves",
  "readme-light-waves",
  "commit-streak-dark",
  "commit-streak-light",
  "top-languages-dark",
  "top-languages-light",
  "contribution-dark",
  "contribution-light",
  "commit-graph-dark-wave",
  "commit-graph-light-wave",
  "commit-graph-dark-rain",
  "commit-graph-light-rain",
  "commit-graph-dark-cascade",
  "commit-graph-light-cascade",
] as const;

export type CompositionId = (typeof COMPOSITIONS)[number];

export interface RenderOptions {
  compositionId: CompositionId;
  userStats: UserStats;
  username: string;
  onProgress?: (event: RenderProgressEvent) => void;
}

export interface RenderResult {
  success: boolean;
  imageKey?: string;
  imageUrl?: string;
  error?: string;
  durationMs: number;
}

export type RenderProgressStage =
  | "bundle"
  | "selectComposition"
  | "renderMedia"
  | "readOutput"
  | "upload"
  | "cleanup";

export interface RenderProgressEvent {
  stage: RenderProgressStage;
  /**
   * Stage progress from 0..1
   */
  progress: number;
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): void {
  if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
  }
}

/**
 * Bundle the Remotion project (cached)
 */
async function getBundlePath(
  onProgress?: (pct: number) => void
): Promise<string> {
  // Production: use prebaked bundle produced during Docker build (Option B).
  if (process.env.NODE_ENV === "production") {
    if (!existsSync(PREBUNDLED_BUNDLE_DIR)) {
      throw new Error(
        `Prebundled Remotion bundle not found at ${PREBUNDLED_BUNDLE_DIR}. ` +
          `This should be generated during the Docker build step.`
      );
    }
    onProgress?.(100);
    return PREBUNDLED_BUNDLE_DIR;
  }

  if (bundlePath && existsSync(bundlePath)) {
    onProgress?.(100);
    return bundlePath;
  }

  console.log("Bundling Remotion project...");
  const startTime = Date.now();

  bundlePath = await bundle({
    entryPoint: REMOTION_ENTRY,
    onProgress: (progress) => {
      onProgress?.(progress);
      if (progress % 25 === 0) {
        console.log(`Bundle progress: ${progress}%`);
      }
    },
    // Match Remotion Studio's webpack config so rendering output matches local previews.
    webpackOverride,
  });

  console.log(`Bundle complete in ${Date.now() - startTime}ms`);
  return bundlePath;
}

/**
 * Render a composition to H.264 MP4, then convert to WebP
 */
export async function renderComposition(
  options: RenderOptions
): Promise<RenderResult> {
  const startTime = Date.now();
  const { compositionId, userStats, username, onProgress } = options;

  // Keep scale consistent with Remotion Studio. Override using RENDER_SCALE if you need crisper output.
  const renderScale = env.RENDER_SCALE;

  ensureTempDir();

  const outputPath = join(
    TEMP_DIR,
    `${username}-${compositionId}-${Date.now()}.mp4`
  );

  try {
    // Get or create bundle
    console.log(`[render ${username}/${compositionId}] getBundlePath...`);
    const serveUrl = await getBundlePath((pct) => {
      onProgress?.({
        stage: "bundle",
        progress: Math.max(0, Math.min(1, pct / 100)),
      });
    });
    console.log(`[render ${username}/${compositionId}] serveUrl ready`);

    // Select the composition
    console.log(`[render ${username}/${compositionId}] selectComposition...`);
    const puppeteerInstance = await getSharedRemotionBrowser({
      chromiumOptions: {
        // Keep in sync with renderMedia() to avoid env-dependent drift.
        gl: "swiftshader",
      },
    });
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      puppeteerInstance,
      inputProps: {
        userStats,
      },
    });
    onProgress?.({ stage: "selectComposition", progress: 1 });
    console.log(
      `[render ${username}/${compositionId}] composition selected: durationInFrames=${composition.durationInFrames} fps=${composition.fps}`
    );

    console.log(`Rendering ${compositionId} for ${username}...`);

    // Render to H.264 MP4
    console.log(
      `[render ${username}/${compositionId}] renderMedia -> ${outputPath}`
    );
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      // Use JPEG frames for faster rendering (no transparency needed)
      videoImageFormat: "jpeg",
      colorSpace: "srgb",
      puppeteerInstance,
      scale: renderScale,
      outputLocation: outputPath,
      inputProps: {
        userStats,
      },
      timeoutInMilliseconds: env.RENDER_TIMEOUT_MS,
      onProgress: ({ progress }) => {
        onProgress?.({
          stage: "renderMedia",
          progress: Math.max(0, Math.min(1, progress)),
        });
        if (Math.round(progress * 100) % 25 === 0) {
          console.log(`Render progress: ${Math.round(progress * 100)}%`);
        }
      },
    });
    console.log(`[render ${username}/${compositionId}] renderMedia done`);

    // Read the rendered MP4 file
    console.log(`[render ${username}/${compositionId}] reading output file`);
    const mp4Buffer = await readFile(outputPath);
    onProgress?.({ stage: "readOutput", progress: 1 });
    console.log(
      `[render ${username}/${compositionId}] read ${mp4Buffer.length} bytes`
    );

    // Convert MP4 to WebP using FFmpeg
    console.log(
      `[render ${username}/${compositionId}] converting MP4 to WebP...`
    );
    onProgress?.({ stage: "convert", progress: 0 });
    const webpBuffer = await convertVideoToWebP(mp4Buffer, {
      quality: 85,
      fps: 30, // Use 30fps for web optimization (reduced from composition.fps)
    });
    onProgress?.({ stage: "convert", progress: 1 });
    const mp4SizeMB = (mp4Buffer.length / (1024 * 1024)).toFixed(2);
    const webpSizeMB = (webpBuffer.length / (1024 * 1024)).toFixed(2);
    const sizeReduction = (
      (1 - webpBuffer.length / mp4Buffer.length) *
      100
    ).toFixed(1);
    const sizeRatio = (mp4Buffer.length / webpBuffer.length).toFixed(2);

    console.log(
      `[render ${username}/${compositionId}] converted to WebP: ${webpBuffer.length} bytes (${webpSizeMB} MB)`
    );
    console.log(
      `[render ${username}/${compositionId}] 📊 Size comparison: MP4=${mp4SizeMB}MB → WebP=${webpSizeMB}MB (${sizeReduction}% reduction, ${sizeRatio}x smaller)`
    );

    // Upload to MinIO
    const imageKey = getImageKey(username, compositionId);
    console.log(
      `[render ${username}/${compositionId}] uploading to MinIO key=${imageKey}`
    );
    onProgress?.({ stage: "upload", progress: 0 });
    await uploadImage(imageKey, webpBuffer, {
      "x-amz-meta-username": username,
      "x-amz-meta-composition": compositionId,
      "x-amz-meta-rendered-at": new Date().toISOString(),
    });
    onProgress?.({ stage: "upload", progress: 1 });
    console.log(`[render ${username}/${compositionId}] upload done`);

    const imageUrl = getPublicUrl(imageKey);
    console.log(`[render ${username}/${compositionId}] imageUrl=${imageUrl}`);

    // Clean up temp file
    rmSync(outputPath, { force: true });
    onProgress?.({ stage: "cleanup", progress: 1 });

    const durationMs = Date.now() - startTime;
    console.log(`Rendered ${compositionId} for ${username} in ${durationMs}ms`);

    return {
      success: true,
      imageKey,
      imageUrl,
      durationMs,
    };
  } catch (error) {
    // Clean up temp file on error
    if (existsSync(outputPath)) {
      rmSync(outputPath, { force: true });
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Render failed for ${compositionId}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Render all compositions for a user
 */
export async function renderAllCompositions(
  username: string,
  userStats: UserStats
): Promise<Map<CompositionId, RenderResult>> {
  const results = new Map<CompositionId, RenderResult>();

  for (const compositionId of COMPOSITIONS) {
    const result = await renderComposition({
      compositionId,
      userStats,
      username,
    });
    results.set(compositionId, result);
  }

  return results;
}

/**
 * Render a subset of compositions (e.g., only dark theme)
 */
export async function renderCompositionsByTheme(
  username: string,
  userStats: UserStats,
  theme: "light" | "dark"
): Promise<Map<CompositionId, RenderResult>> {
  const results = new Map<CompositionId, RenderResult>();

  const filteredCompositions = COMPOSITIONS.filter((id) => id.includes(theme));

  for (const compositionId of filteredCompositions) {
    const result = await renderComposition({
      compositionId,
      userStats,
      username,
    });
    results.set(compositionId, result);
  }

  return results;
}

/**
 * Invalidate the bundle cache (e.g., after code updates)
 */
export function invalidateBundleCache(): void {
  if (bundlePath && existsSync(bundlePath)) {
    rmSync(bundlePath, { recursive: true, force: true });
  }
  bundlePath = null;
  console.log("Bundle cache invalidated");
}

/**
 * Pre-warm the bundle cache
 */
export async function warmupBundle(): Promise<void> {
  console.log("Pre-warming bundle cache...");
  await getBundlePath();
}
