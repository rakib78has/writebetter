import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

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
const FIXTURES_PATH = resolve(import.meta.dirname, '../fixtures');

/**
 * Test pages are served from this origin by Playwright itself, not a real
 * server, so tests never touch the network. It must be http(s): Chrome never
 * lets extensions script data: or file: URLs, so those would not behave like
 * the sites users visit.
 */
export const FIXTURE_ORIGIN = 'https://fixture.test';
/** A second origin serving the same pages, for cross-origin navigation. */
export const OTHER_FIXTURE_ORIGIN = 'https://other.fixture.test';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
};

export interface ExtensionFixtures {
  context: BrowserContext;
  /** The MV3 background service worker. */
  serviceWorker: Worker;
  /** The extension's generated id, needed to build chrome-extension:// URLs. */
  extensionId: string;
  /** Opens a page from tests/fixtures, e.g. `openFixture('editors.html')`. */
  openFixture: (name: string, origin?: string) => Promise<Page>;
  /** Does what a click on the toolbar icon does for `page`, including the
   *  activeTab grant, then returns the popup, opened as a page. */
  invokeExtensionOn: (page: Page) => Promise<Page>;
  /** Opens the popup for `page` without invoking the extension, so no
   *  access is granted. */
  openPopupWithoutAccess: (page: Page) => Promise<Page>;
}

export const test = base.extend<ExtensionFixtures>({
  // `headless` is Playwright's own option, so `--headed` still works.
  context: async ({ headless }, use, testInfo) => {
    const userDataDir = await mkdtemp(join(tmpdir(), 'writebetter-profile-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        // Allows the DevTools protocol's Extensions domain, used below to
        // trigger the extension action the way a user's click does.
        '--enable-unsafe-extension-debugging',
      ],
    });

    await context.route(/^https:\/\/(other\.)?fixture\.test\//, async (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      // /editors/... are the rich-text editor pages built by
      // scripts/build-test-editors.mjs; everything else is a plain fixture.
      const file = name.startsWith('editors/')
        ? join(FIXTURES_PATH, '.built-editors', name.slice('editors/'.length))
        : join(FIXTURES_PATH, name);
      try {
        const body = await readFile(file);
        const contentType = CONTENT_TYPES[extname(file)] ?? 'application/octet-stream';
        await route.fulfill({ contentType, body });
      } catch {
        await route.fulfill({ status: 404, body: `No fixture named ${name}` });
      }
    });

    // Every extension page is watched for uncaught errors and console
    // errors. Any test that produces one fails, with the messages attached
    // to its report, so problems no assertion looks for are still caught.
    const extensionErrors: string[] = [];
    const watch = (page: Page) => {
      const record = (kind: string, text: string) => {
        if (page.url().startsWith('chrome-extension://')) {
          extensionErrors.push(`[${kind}] ${new URL(page.url()).pathname}: ${text}`);
        }
      };
      page.on('pageerror', (error) => {
        record('uncaught', error.message);
      });
      page.on('console', (message) => {
        if (message.type() === 'error') record('console', message.text());
      });
    };
    context.pages().forEach(watch);
    context.on('page', watch);

    await use(context);

    await context.close();
    await rm(userDataDir, { recursive: true, force: true });

    if (extensionErrors.length > 0) {
      await testInfo.attach('extension-errors.txt', { body: extensionErrors.join('\n') });
      throw new Error(`Extension pages logged errors:\n${extensionErrors.join('\n')}`);
    }
  },

  serviceWorker: async ({ context }, use) => {
    // The worker may already be running before this fixture asks for it.
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  openFixture: async ({ context }, use) => {
    await use(async (name, origin = FIXTURE_ORIGIN) => {
      const page = await context.newPage();
      await page.goto(`${origin}/${name}`);
      return page;
    });
  },

  openPopupWithoutAccess: async ({ context, extensionId, serviceWorker }, use) => {
    await use(async (page) => {
      const tabId = await activeTabId(page, serviceWorker);
      const popup = await context.newPage();
      await popup.goto(extensionUrl(extensionId, `popup/index.html?tab=${tabId}`));
      return popup;
    });
  },

  invokeExtensionOn: async ({ context, extensionId, serviceWorker }, use) => {
    await use(async (page) => {
      const tabId = await activeTabId(page, serviceWorker);

      // Extensions.triggerAction is what Chrome itself does when the toolbar
      // icon is clicked: it grants activeTab for the tab and opens the real
      // popup. Playwright cannot attach to that popup window, so the same
      // popup page is then opened in a tab and told which tab to read.
      const browser = context.browser();
      if (!browser) throw new Error('Expected a browser handle for the persistent context');
      const cdp = await browser.newBrowserCDPSession();
      try {
        // Each page sits inside a "tab" target, which triggerAction requires.
        // Tab targets are hidden unless every type is asked for.
        const { targetInfos } = await cdp.send('Target.getTargets', { filter: [{}] });
        const tab = targetInfos.find((info) => info.type === 'tab' && info.url === page.url());
        if (!tab) throw new Error(`No tab target found for ${page.url()}`);
        await cdp.send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
      } finally {
        await cdp.detach();
      }

      const popup = await context.newPage();
      await popup.goto(extensionUrl(extensionId, `popup/index.html?tab=${tabId}`));
      return popup;
    });
  },
});

export const expect = test.expect;

export function extensionUrl(extensionId: string, path: string): string {
  return `chrome-extension://${extensionId}/${path}`;
}

/** The Chrome tab id of `page`, which must be the frontmost tab. */
async function activeTabId(page: Page, serviceWorker: Worker): Promise<number> {
  await page.bringToFront();
  const id = await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.id;
  });
  if (id === undefined) throw new Error('Could not find the active tab');
  return id;
}

/** Focuses a field on `page` and selects characters [start, end). */
export async function selectInField(page: Page, selector: string, start: number, end: number) {
  await page.locator(selector).evaluate(
    (element, [from, to]) => {
      const field = element as HTMLInputElement | HTMLTextAreaElement;
      field.focus();
      field.setSelectionRange(from, to);
    },
    [start, end] as const
  );
}

/**
 * Focuses a rich-text editor and selects from the start of `from` to the end
 * of `to`, both matched as text inside it.
 */
export async function selectInEditor(page: Page, selector: string, from: string, to: string) {
  await page.locator(selector).evaluate(
    (host, [first, last]) => {
      (host as HTMLElement).focus();
      const texts: Text[] = [];
      const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) texts.push(walker.currentNode as Text);
      const find = (needle: string, atEnd: boolean): [Text, number] => {
        for (const node of texts) {
          const index = node.data.indexOf(needle);
          if (index >= 0) return [node, atEnd ? index + needle.length : index];
        }
        throw new Error(`"${needle}" not found in the editor`);
      };
      const range = document.createRange();
      range.setStart(...find(first, false));
      range.setEnd(...find(last, true));
      const selection = document.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    [from, to] as const
  );
  // Editors pick up DOM selection changes on the next "selectionchange".
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
}
