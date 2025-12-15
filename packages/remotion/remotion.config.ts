/**
 * Remotion Configuration
 * 
 * Optimized for smaller GIF file sizes while maintaining quality.
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { webpackOverride } from './src/webpack-override';

// Keep scale consistent between Studio renders and server renders.
// The server uses packages/server/src/config/env.ts -> RENDER_SCALE.
const scaleFromEnv = Number(process.env.RENDER_SCALE ?? 1);
const scale = Number.isFinite(scaleFromEnv) && scaleFromEnv > 0 ? scaleFromEnv : 1;
Config.setScale(scale);

// Output format
Config.setCodec('gif');

// PNG format required for transparency support
Config.setVideoImageFormat('png');

// Always overwrite existing output files
Config.setOverwriteOutput(true);

// Enable Tailwind CSS v4
Config.overrideWebpackConfig(webpackOverride);

// Performance optimizations for smaller GIF sizes:
// - Lower FPS (20) is set in src/config.ts
// - Shorter duration (8s) is set in src/config.ts
// - Reduced dimensions (450px) are set per composition in Root.tsx
