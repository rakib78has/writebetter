export const MENU_ITEM_ID = 'writebetter-improve';

/** The slice of the Chrome API this module uses, so tests can supply a fake. */
export interface ContextMenuApi {
  contextMenus: Pick<typeof chrome.contextMenus, 'removeAll' | 'create'>;
  action: Pick<typeof chrome.action, 'openPopup'>;
  runtime: Pick<typeof chrome.runtime, 'lastError'>;
}

/**
 * Adds "Improve with WriteBetter" to the right-click menu of text fields.
 *
 * Chrome keeps menu items across browser restarts, so they are registered on
 * install and update only. Removing them first avoids a duplicate-id error
 * when the extension is updated or reloaded.
 */
export async function registerContextMenu(api: ContextMenuApi): Promise<void> {
  await api.contextMenus.removeAll();
  api.contextMenus.create(
    { id: MENU_ITEM_ID, title: 'Improve with WriteBetter', contexts: ['editable'] },
    () => {
      // create() reports failure only through lastError; reading it here is
      // also what stops Chrome logging "Unchecked runtime.lastError".
      const error = api.runtime.lastError;
      if (error) console.error('WriteBetter: could not create the context menu:', error.message);
    }
  );
}

/**
 * Opens the popup when the menu item is clicked.
 *
 * The click itself grants activeTab for that tab, so the popup can then read
 * the selection just as if the toolbar icon had been clicked. The selected
 * text Chrome passes in `info` is deliberately not used or logged: the popup
 * reads the selection itself, with the field and offsets it needs.
 */
export async function handleContextMenuClick(
  api: ContextMenuApi,
  info: Pick<chrome.contextMenus.OnClickData, 'menuItemId'>,
  tab: Pick<chrome.tabs.Tab, 'windowId'> | undefined
): Promise<void> {
  if (info.menuItemId !== MENU_ITEM_ID) return;
  try {
    await api.action.openPopup(tab ? { windowId: tab.windowId } : undefined);
  } catch (error) {
    // For example, the window closed or lost focus before the popup opened.
    // The user can still click the toolbar icon.
    console.warn('WriteBetter: could not open the popup:', String(error));
  }
}
