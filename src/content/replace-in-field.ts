import type { ReplaceRequest, ReplaceResult } from '../shared/replace.ts';

/**
 * Replaces text in the page's focused field, if it still holds what the user
 * saw. Runs inside the web page, injected by chrome.scripting.executeScript
 * only after the user has confirmed the replacement.
 *
 * Like captureSelection(), Chrome sends this function's source to the page,
 * so it must be self-contained. That is why the field checks below repeat
 * the ones in capture-selection.ts instead of sharing a helper.
 */
export function replaceInField(request: ReplaceRequest): ReplaceResult {
  const SELECTABLE_INPUT_TYPES = ['text', 'search', 'url', 'tel'];
  const SENSITIVE_AUTOCOMPLETE =
    /(?:^|\s)(?:current-password|new-password|one-time-code|cc-\S+)(?:\s|$)/i;

  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) {
    element = element.shadowRoot.activeElement;
  }

  const field =
    element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement ? element : null;
  if (
    !field ||
    (field instanceof HTMLInputElement && !SELECTABLE_INPUT_TYPES.includes(field.type)) ||
    // A sensitive field is never read, so it is treated as if it were gone.
    SENSITIVE_AUTOCOMPLETE.test(field.autocomplete)
  ) {
    return { status: 'field-gone' };
  }
  if (field.readOnly || field.disabled) return { status: 'read-only' };

  const { start, end, expected, replacement } = request;
  if (field.value.slice(start, end) !== expected) return { status: 'changed' };

  const newLength = field.value.length - (end - start) + replacement.length;
  if (field.maxLength >= 0 && newLength > field.maxLength) return { status: 'too-long' };

  field.focus();
  field.setSelectionRange(start, end);

  // execCommand('insertText') edits the field the way typing does: the change
  // joins the browser's own undo history (Ctrl+Z works) and fires the input
  // events that page frameworks such as React listen for. It is deprecated,
  // but nothing else preserves undo. Where it is missing or refused, fall
  // back to setRangeText plus a synthetic input event; undo is lost there.
  /* eslint-disable @typescript-eslint/no-deprecated -- deliberate, see above */
  const inserted =
    typeof document.execCommand === 'function' &&
    document.execCommand(replacement === '' ? 'delete' : 'insertText', false, replacement);
  /* eslint-enable @typescript-eslint/no-deprecated */
  if (!inserted) {
    field.setRangeText(replacement, start, end, 'end');
    field.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        inputType: 'insertReplacementText',
        data: replacement,
      })
    );
  }
  field.dispatchEvent(new Event('change', { bubbles: true }));

  const after = start + replacement.length;
  if (field.value.slice(start, after) !== replacement) return { status: 'failed' };
  // Select the new text so the user can see exactly what changed.
  field.setSelectionRange(start, after);
  return { status: 'replaced' };
}
