import { describe, expect, it, vi } from 'vitest';
import { captureSelection } from '../../src/content/capture-selection.ts';
import { loadSelection, type SelectionApi } from '../../src/popup/selection-source.ts';

const CAPTURE = {
  status: 'captured',
  text: 'hello',
  field: 'input',
  selection: { start: 0, end: 5 },
  readOnly: false,
};

/** A fake of the two Chrome APIs the popup uses to read a selection. */
function fakeChrome({
  activeTabs = [{ id: 7 }] as { id?: number }[],
  inject = (): Promise<unknown[]> => Promise.resolve([{ frameId: 0, result: CAPTURE }]),
} = {}) {
  const query = vi.fn(() => Promise.resolve(activeTabs));
  const executeScript = vi.fn(inject);
  // The fake implements only what loadSelection calls; the cast stands in
  // for Chrome's much larger overloaded signatures.
  const api = { tabs: { query }, scripting: { executeScript } } as unknown as SelectionApi;
  return { api, query, executeScript };
}

describe('loadSelection', () => {
  // WB-INT-012
  it('injects the capture function into the active tab of the popup window', async () => {
    const { api, query, executeScript } = fakeChrome();

    await expect(loadSelection(api, '')).resolves.toEqual(CAPTURE);
    expect(query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(executeScript).toHaveBeenCalledWith({ target: { tabId: 7 }, func: captureSelection });
  });

  // WB-INT-013
  it('injects only into the main frame, never into every frame', async () => {
    const { api, executeScript } = fakeChrome();
    await loadSelection(api, '');
    const [[options]] = executeScript.mock.calls as unknown as [[{ target: object }]];
    expect(options.target).not.toHaveProperty('allFrames');
  });

  // WB-INT-014
  it('reads from the tab named in ?tab= without asking for the active tab', async () => {
    const { api, query, executeScript } = fakeChrome();

    await loadSelection(api, '?tab=42');

    expect(query).not.toHaveBeenCalled();
    expect(executeScript).toHaveBeenCalledWith(expect.objectContaining({ target: { tabId: 42 } }));
  });

  // WB-INT-015
  it.each(['?tab=abc', '?tab=-1', '?tab=1.5', '?tab=', '?tab=1e3', '?tab=99999999999999999'])(
    'treats an invalid tab parameter (%s) as no page',
    async (search) => {
      const { api, executeScript } = fakeChrome();
      await expect(loadSelection(api, search)).resolves.toEqual({ status: 'page-unavailable' });
      expect(executeScript).not.toHaveBeenCalled();
    }
  );

  // WB-INT-016
  it('reports the page as unavailable when there is no active tab', async () => {
    const { api } = fakeChrome({ activeTabs: [] });
    await expect(loadSelection(api, '')).resolves.toEqual({ status: 'page-unavailable' });
  });

  // WB-INT-017
  it('reports the page as unavailable when Chrome refuses to script it', async () => {
    const { api } = fakeChrome({
      inject: () => Promise.reject(new Error('Cannot access a chrome:// URL')),
    });
    await expect(loadSelection(api, '')).resolves.toEqual({ status: 'page-unavailable' });
  });

  // WB-INT-018
  it.each<[string, unknown[]]>([
    ['no frame results', []],
    ['an undefined result', [{ frameId: 0, result: undefined }]],
    ['a malformed result', [{ frameId: 0, result: { status: 'captured', text: 5 } }]],
  ])('reports a failure for %s', async (_label, results) => {
    const { api } = fakeChrome({ inject: () => Promise.resolve(results) });
    await expect(loadSelection(api, '')).resolves.toEqual({ status: 'failed' });
  });
});
