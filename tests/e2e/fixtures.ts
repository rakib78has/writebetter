import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';

/**
 * Playwright fixtures for testing the loaded extension.
 *
 * An extension cannot be loaded into the browser Playwright normally provides.
 * It needs `chromium.launchPersistentContext` with `--load-extension` pointing
 * at the built dist/ directory. Branded Google Chrome ignores that flag, so
 * the `chromium` channel (Playwright's own build) is required. Its headless
 * mode is the new one, which does run extensions.
 */

const EXTENSION_PATH = resolve(import.meta.dirname, '../../dist');

export interface ExtensionFixtures {
  context: BrowserContext;
  /** The MV3 background service worker. */
  serviceWorker: Worker;
  /** The extension's generated id, needed to build chrome-extension:// URLs. */
  extensionId: string;
}

export const test = base.extend<ExtensionFixtures>({
  // `headless` is Playwright's own option, so `--headed` still works.
  context: async ({ headless }, use) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'writebetter-profile-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless,
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    });

    await use(context);

    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },

  serviceWorker: async ({ context }, use) => {
    // The worker may already be running before this fixture asks for it.
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export const expect = test.expect;

export function extensionUrl(extensionId: string, path: string): string {
  return `chrome-extension://${extensionId}/${path}`;
}
