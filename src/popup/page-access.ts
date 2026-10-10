import { captureSelection } from '../content/capture-selection.ts';
import { replaceInField } from '../content/replace-in-field.ts';
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

/** Reads the user's selection from the target tab's main frame. */
export async function loadSelection(api: PageApi, search: string): Promise<SelectionOutcome> {
  let results: chrome.scripting.InjectionResult[];
  try {
    const tabId = await findTargetTabId(api, search);
    if (tabId === undefined) return { status: 'page-unavailable' };
    results = await api.scripting.executeScript({ target: { tabId }, func: captureSelection });
  } catch {
    // Chrome refuses to script browser pages, the Web Store and pages the
    // user has not granted access to. The error text is not a stable API, so
    // every refusal is treated the same way.
    return { status: 'page-unavailable' };
  }

  return parseCaptureResult(results[0]?.result) ?? { status: 'failed' };
}

export type ReplaceOutcome = ReplaceResult | { status: 'page-unavailable' };

/**
 * Replaces text in the target tab's focused field. Call only after the user
 * has confirmed: this changes their page.
 */
export async function replaceOnPage(
  api: PageApi,
  search: string,
  request: ReplaceRequest
): Promise<ReplaceOutcome> {
  let results: chrome.scripting.InjectionResult[];
  try {
    const tabId = await findTargetTabId(api, search);
    if (tabId === undefined) return { status: 'page-unavailable' };
    results = await api.scripting.executeScript({
      target: { tabId },
      func: replaceInField,
      args: [request],
    });
  } catch {
    // Most often the tab moved to another site, which ends activeTab access.
    return { status: 'page-unavailable' };
  }

  return parseReplaceResult(results[0]?.result);
}
