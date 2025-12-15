import type { WebpackOverrideFn } from '@remotion/bundler';
import { enableTailwind } from '@remotion/tailwind-v4';

/**
 * Shared Webpack override for both:
 * - Remotion CLI (Studio / render)
 * - Node.js server-side bundling (bundle() API)
 *
 * Remotion's Node.js APIs do not read `remotion.config.ts`, so we keep this override
 * in a separate module and import it from both places.
 */
export const webpackOverride: WebpackOverrideFn = (currentConfiguration) => {
	return enableTailwind(currentConfiguration);
};


