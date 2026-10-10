import { runInPage, type PageRequest } from '../content/page-script.ts';
import { parseCaptureResult, type CaptureResult } from '../shared/capture.ts';
import { parseReplaceResult, type ReplaceRequest, type ReplaceResult } from '../shared/replace.ts';

export type SelectionOutcome =
  | CaptureResult
  /** The page cannot be scripted: a browser page, the Web Store, a page
   *  that was navigated away from, or no tab at all. */
  | { status: 'page-unavailable' }
  /** The page answered, but with something that is not a valid result. */
  | { status: 'failed' };

/** The slice of the Chrome API this module uses, so tests can supply a fake. */
export interface PageApi {
  tabs: Pick<typeof chrome.tabs, 'query'>;
  scripting: Pick<typeof chrome.scripting, 'executeScript'>;
}

/**
 * Finds the tab to read from or write to.
 *
 * Opened from the toolbar, the popup works on the active tab of its window.
 * Opened as an ordinary page, which is how the end-to-end tests drive it, it
 * is told the tab with `?tab=<id>`. That grants no access by itself: Chrome
 * still allows access only if the user has invoked the extension on that
 * tab (the activeTab permission).
 */
async function findTargetTabId(api: PageApi, search: string): Promise<number | undefined> {
  const requested = new URLSearchParams(search).get('tab');
  if (requested !== null) {
    // Checked as text first, because Number('') is 0, a plausible tab id.
    if (!/^\d+$/.test(requested)) return undefined;
    const id = Number(requested);
    return Number.isSafeInteger(id) ? id : undefined;
  }
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

/**
 * Runs the page script in the target tab's main frame. The answer is raw and
 * unvalidated. Throws if Chrome refuses to script the page.
 */
async function sendToPage(
  api: PageApi,
  search: string,
  message: PageRequest
): Promise<{ reached: false } | { reached: true; answer: unknown }> {
  const tabId = await findTargetTabId(api, search);
  if (tabId === undefined) return { reached: false };
  const results = await api.scripting.executeScript({
    target: { tabId },
    func: runInPage,
    args: [message],
  });
  return { reached: true, answer: results[0]?.result };
}

/** Reads the user's selection from the target tab's main frame. */
export async function loadSelection(api: PageApi, search: string): Promise<SelectionOutcome> {
  let sent: Awaited<ReturnType<typeof sendToPage>>;
  try {
    sent = await sendToPage(api, search, { type: 'capture' });
  } catch {
    // Chrome refuses to script browser pages, the Web Store and pages the
    // user has not granted access to. The error text is not a stable API, so
    // every refusal is treated the same way.
    return { status: 'page-unavailable' };
  }

  if (!sent.reached) return { status: 'page-unavailable' };
  return parseCaptureResult(sent.answer) ?? { status: 'failed' };
}

export type ReplaceOutcome = ReplaceResult | { status: 'page-unavailable' };

/**
 * Replaces text in the target tab's focused field or editor. Call only after the user
 * has confirmed: this changes their page.
 */
export async function replaceOnPage(
  api: PageApi,
  search: string,
  request: ReplaceRequest
): Promise<ReplaceOutcome> {
  let sent: Awaited<ReturnType<typeof sendToPage>>;
  try {
    sent = await sendToPage(api, search, { type: 'replace', request });
  } catch {
    // Most often the tab moved to another site, which ends activeTab access.
    return { status: 'page-unavailable' };
  }

  if (!sent.reached) return { status: 'page-unavailable' };
  return parseReplaceResult(sent.answer);
}
