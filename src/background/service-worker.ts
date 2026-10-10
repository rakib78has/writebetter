/**
 * Background service worker.
 *
 * Milestone 1 registers the worker and proves it builds and loads; it has no
 * event handlers yet. Milestone 2 adds the context menu and the keyboard
 * command here.
 *
 * Chrome stops an idle worker after about 30 seconds, so nothing that must
 * survive between events may live in module-level variables. Use
 * chrome.storage instead.
 */
export {};
