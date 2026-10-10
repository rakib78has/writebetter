import { handleContextMenuClick, registerContextMenu } from './context-menu.ts';

/**
 * Background service worker.
 *
 * Chrome stops an idle worker after about 30 seconds and starts it again when
 * an event arrives. Listeners must therefore be registered synchronously at
 * the top level, every time the worker starts, or events that wake it are
 * missed. Nothing that must survive between events may live in a variable.
 *
 * The keyboard shortcut needs no code here: the manifest maps it to
 * `_execute_action`, which Chrome handles by opening the popup.
 */

chrome.runtime.onInstalled.addListener(() => {
  void registerContextMenu(chrome);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void handleContextMenuClick(chrome, info, tab);
});
