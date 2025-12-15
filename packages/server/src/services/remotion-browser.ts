import type { Browser } from 'puppeteer';
import { openBrowser } from '@remotion/renderer';

let browserPromise: Promise<Browser> | null = null;

export type RemotionBrowserOptions = {
	chromiumOptions?: Parameters<typeof openBrowser>[1]['chromiumOptions'];
	browserExecutable?: string | null;
};

/**
 * Open a single shared Puppeteer browser instance for the worker process.
 * Remotion recommends reusing a `puppeteerInstance` across renders for speed.
 *
 * Note: Chromium flags must be set at browser launch. If you pass a puppeteer instance
 * to renderMedia/selectComposition, chromiumOptions passed there will not apply.
 */
export function getSharedRemotionBrowser(
	options: RemotionBrowserOptions = {}
): Promise<Browser> {
	if (browserPromise) return browserPromise;

	browserPromise = openBrowser('chrome', {
		browserExecutable: options.browserExecutable ?? null,
		chromiumOptions: options.chromiumOptions,
	});

	return browserPromise;
}

export async function closeSharedRemotionBrowser(): Promise<void> {
	if (!browserPromise) return;
	const b = await browserPromise;
	browserPromise = null;
	await b.close();
}


