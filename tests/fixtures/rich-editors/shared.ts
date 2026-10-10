/** The content every editor test page starts with: bold text, a link and two
 *  paragraphs, so tests can check formatting and structure survive. */
export const INITIAL_HTML =
  '<p>Hi all, we <strong>was late</strong> and <a href="https://example.com/build">teh build</a> failed.</p>' +
  '<p>Thanks for your patience.</p>';

declare global {
  interface Window {
    /** The editor's text as its own model sees it, paragraphs joined by "\n". */
    editorText: () => string;
    editorReady: boolean;
  }
}

export function exposeEditor(read: () => string) {
  window.editorText = read;
  window.editorReady = true;
}
