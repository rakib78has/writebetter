import type { CaptureResult } from '../shared/capture.ts';

/**
 * Reads the selected text from the focused text field of the current page.
 *
 * Runs inside the web page, injected by chrome.scripting.executeScript only
 * after the user has asked for it. Chrome sends this function's *source code*
 * to the page, not the function itself, so it must be fully self-contained:
 * no imports, and no references to anything outside its own body. The type
 * import above is erased at build time and is fine.
 *
 * Privacy rules enforced here:
 * - Only the selected part of the field is read, never the whole value or
 *   anything else on the page.
 * - Password, one-time-code and payment fields are recognised from their
 *   attributes and their value is never touched.
 */
export function captureSelection(): CaptureResult {
  // Input types whose value can be selected and read through the
  // selectionStart/selectionEnd API. Others (email, number, date...) either
  // don't support it or don't hold prose.
  const SELECTABLE_INPUT_TYPES = ['text', 'search', 'url', 'tel'];
  // Autocomplete tokens that mark a field as sensitive even when its type
  // is plain text.
  const SENSITIVE_AUTOCOMPLETE =
    /(?:^|\s)(?:current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i;

  let element = document.activeElement;
  // Focus inside an open shadow root shows up as the shadow host. Follow it
  // down to the element that actually has focus.
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement;
  }

  if (element instanceof HTMLIFrameElement) {
    return { status: 'unsupported-field', reason: 'frame' };
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const isPassword = element instanceof HTMLInputElement && element.type === 'password';
    if (isPassword || SENSITIVE_AUTOCOMPLETE.test(element.autocomplete)) {
      return { status: 'sensitive-field' };
    }
    if (element instanceof HTMLInputElement && !SELECTABLE_INPUT_TYPES.includes(element.type)) {
      return { status: 'unsupported-field', reason: 'input-type' };
    }

    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    if (start === end) return { status: 'empty-selection' };

    return {
      status: 'captured',
      text: element.value.slice(start, end),
      field: element instanceof HTMLInputElement ? 'input' : 'textarea',
      selection: { start, end },
      readOnly: element.readOnly || element.disabled,
    };
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return { status: 'unsupported-field', reason: 'contenteditable' };
  }

  return { status: 'no-field' };
}
