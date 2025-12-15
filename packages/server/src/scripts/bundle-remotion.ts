import { bundle } from '@remotion/bundler';
import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// This script is intended to run inside the repo root (e.g. /app in Docker build).
// It produces an immutable bundle that gets baked into the image.

const repoRoot = process.cwd();
const remotionRootDir = join(repoRoot, 'packages/remotion');
const entryPoint = join(remotionRootDir, 'src/index.ts');
const publicDir = join(remotionRootDir, 'public');

// Bundle location baked into the image. The renderer will use this in production.
const outDir = join(repoRoot, 'packages/server/remotion-bundle');

// Import the shared webpack override from the Remotion package so SSR bundling
// and Studio use the exact same Webpack configuration.
const { webpackOverride } = await import(
	join(remotionRootDir, 'src/webpack-override.ts')
);

console.log(`[prebundle] entryPoint=${entryPoint}`);
console.log(`[prebundle] rootDir=${remotionRootDir}`);
console.log(`[prebundle] publicDir=${publicDir}`);
console.log(`[prebundle] outDir=${outDir}`);

// Ensure we don't accidentally serve a stale bundle.
if (existsSync(outDir)) {
	rmSync(outDir, { recursive: true, force: true });
}

await bundle({
	entryPoint,
	rootDir: remotionRootDir,
	publicDir,
	outDir,
	webpackOverride,
	onProgress: (progress) => {
		const pct = Math.round(progress);
		if (pct % 10 === 0) {
			console.log(`[prebundle] progress=${pct}%`);
		}
	},
});

console.log('[prebundle] done');


