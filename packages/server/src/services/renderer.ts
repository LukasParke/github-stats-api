import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { enableTailwind } from "@remotion/tailwind-v4";
import { existsSync, mkdirSync, rmSync } from "fs";
import { readFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env";
import { uploadImage, getImageKey, getPublicUrl } from "./storage";
import type { UserStats } from "./github";

// Get current directory
const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the Remotion package
// In the container image the monorepo lives at /app and packages are under /app/packages/*
// This file is at /app/packages/server/src/services, so ../../../remotion resolves to /app/packages/remotion
const REMOTION_PKG = join(__dirname, "../../../remotion");
const REMOTION_ENTRY = join(REMOTION_PKG, "src/index.ts");
const TEMP_DIR = join(__dirname, "../../temp");

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
async function getBundlePath(onProgress?: (pct: number) => void): Promise<string> {
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
    webpackOverride: enableTailwind,
  });

  console.log(`Bundle complete in ${Date.now() - startTime}ms`);
  return bundlePath;
}

/**
 * Render a composition to GIF
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
    `${username}-${compositionId}-${Date.now()}.gif`
  );

  try {
    // Get or create bundle
    console.log(`[render ${username}/${compositionId}] getBundlePath...`);
    const serveUrl = await getBundlePath((pct) => {
      onProgress?.({ stage: "bundle", progress: Math.max(0, Math.min(1, pct / 100)) });
    });
    console.log(`[render ${username}/${compositionId}] serveUrl ready`);

    // Select the composition
    console.log(`[render ${username}/${compositionId}] selectComposition...`);
    const composition = await selectComposition({
      serveUrl,
      id: compositionId,
      inputProps: {
        userStats,
      },
    });
    onProgress?.({ stage: "selectComposition", progress: 1 });
    console.log(
      `[render ${username}/${compositionId}] composition selected: durationInFrames=${composition.durationInFrames} fps=${composition.fps}`
    );

    console.log(`Rendering ${compositionId} for ${username}...`);

    // Render to GIF
    console.log(
      `[render ${username}/${compositionId}] renderMedia -> ${outputPath}`
    );
    await renderMedia({
      composition,
      serveUrl,
      codec: "gif",
      // Important: use PNG frames so alpha is preserved (JPEG frames will matte transparency to white).
      imageFormat: "png",
      scale: renderScale,
      outputLocation: outputPath,
      inputProps: {
        userStats,
      },
      timeoutInMilliseconds: env.RENDER_TIMEOUT_MS,
      onProgress: ({ progress }) => {
        onProgress?.({ stage: "renderMedia", progress: Math.max(0, Math.min(1, progress)) });
        if (Math.round(progress * 100) % 25 === 0) {
          console.log(`Render progress: ${Math.round(progress * 100)}%`);
        }
      },
    });
    console.log(`[render ${username}/${compositionId}] renderMedia done`);

    // Read the rendered file
    console.log(`[render ${username}/${compositionId}] reading output file`);
    const gifBuffer = await readFile(outputPath);
    onProgress?.({ stage: "readOutput", progress: 1 });
    console.log(
      `[render ${username}/${compositionId}] read ${gifBuffer.length} bytes`
    );

    // Upload to MinIO
    const imageKey = getImageKey(username, compositionId);
    console.log(
      `[render ${username}/${compositionId}] uploading to MinIO key=${imageKey}`
    );
    onProgress?.({ stage: "upload", progress: 0 });
    await uploadImage(imageKey, gifBuffer, {
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
