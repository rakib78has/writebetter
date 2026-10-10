import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleContextMenuClick,
  MENU_ITEM_ID,
  registerContextMenu,
  type ContextMenuApi,
} from '../../src/background/context-menu.ts';

function fakeChrome({ openPopup = () => Promise.resolve() } = {}) {
  const calls: string[] = [];
  const runtime: { lastError?: { message: string } } = {};
  const removeAll = vi.fn(() => {
    calls.push('removeAll');
    return Promise.resolve();
  });
  const create = vi.fn((_props: unknown, callback?: () => void) => {
    calls.push('create');
    callback?.();
    return MENU_ITEM_ID;
  });
  const open = vi.fn(openPopup);
  const api = {
    contextMenus: { removeAll, create },
    action: { openPopup: open },
    runtime,
  } as unknown as ContextMenuApi;
  return { api, calls, create, open, runtime };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('registerContextMenu', () => {
  // WB-INT-019
  it('clears old items, then adds one entry for text fields only', async () => {
    const { api, calls, create } = fakeChrome();

    await registerContextMenu(api);

    expect(calls).toEqual(['removeAll', 'create']);
    expect(create).toHaveBeenCalledWith(
      { id: MENU_ITEM_ID, title: 'Improve with WriteBetter', contexts: ['editable'] },
      expect.any(Function)
    );
  });

  // WB-INT-020
  it('reports a creation failure instead of hiding it', async () => {
    const { api, runtime } = fakeChrome();
    runtime.lastError = { message: 'Cannot create item with duplicate id' };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await registerContextMenu(api);

    expect(error).toHaveBeenCalledWith(
      'WriteBetter: could not create the context menu:',
      'Cannot create item with duplicate id'
    );
  });
});

describe('handleContextMenuClick', () => {
  // WB-INT-021
  it('opens the popup in the window where the menu was used', async () => {
    const { api, open } = fakeChrome();
    await handleContextMenuClick(api, { menuItemId: MENU_ITEM_ID }, { windowId: 3 });
    expect(open).toHaveBeenCalledWith({ windowId: 3 });
  });

  // WB-INT-022
  it('ignores clicks on menu items that are not its own', async () => {
    const { api, open } = fakeChrome();
    await handleContextMenuClick(api, { menuItemId: 'something-else' }, { windowId: 3 });
    expect(open).not.toHaveBeenCalled();
  });

  // WB-INT-023
  it('logs a warning without the selected text when the popup cannot open', async () => {
    const { api } = fakeChrome({
      openPopup: () => Promise.reject(new Error('No active browser window')),
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const info = { menuItemId: MENU_ITEM_ID, selectionText: 'my private draft' };

    await expect(handleContextMenuClick(api, info, undefined)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledOnce();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('my private draft');
  });
});
