/**
 * The result of reading the user's selection from a web page.
 *
 * Produced by captureSelection() inside the page and returned to the popup.
 * The page is not trusted, so the popup checks the shape with
 * parseCaptureResult() before using it.
 */
export type CaptureResult =
  | {
      status: 'captured';
      text: string;
      field: 'input' | 'textarea';
      /** Character offsets of the selection in the field's value, kept for
       *  replacing the text later. */
      selection: { start: number; end: number };
      /** The field can be read but not edited. */
      readOnly: boolean;
    }
  /** Focus is in a supported text field, but nothing is selected. */
  | { status: 'empty-selection' }
  /** Focus is not in a text field at all. */
  | { status: 'no-field' }
  /** A password, one-time-code or payment field. Its value is never read. */
  | { status: 'sensitive-field' }
  /** A text-editing surface WriteBetter does not support yet. */
  | { status: 'unsupported-field'; reason: UnsupportedReason };

export type UnsupportedReason = 'contenteditable' | 'frame' | 'input-type';

const UNSUPPORTED_REASONS: readonly string[] = [
  'contenteditable',
  'frame',
  'input-type',
] satisfies UnsupportedReason[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOffset(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Checks that a value from the page is a well-formed CaptureResult and
 * returns a fresh copy containing only the known fields, or null.
 */
export function parseCaptureResult(value: unknown): CaptureResult | null {
  if (!isRecord(value)) return null;

  switch (value.status) {
    case 'empty-selection':
    case 'no-field':
    case 'sensitive-field':
      return { status: value.status };

    case 'unsupported-field':
      return typeof value.reason === 'string' && UNSUPPORTED_REASONS.includes(value.reason)
        ? { status: 'unsupported-field', reason: value.reason as UnsupportedReason }
        : null;

    case 'captured': {
      const { text, field, selection, readOnly } = value;
      if (typeof text !== 'string' || text.length === 0) return null;
      if (field !== 'input' && field !== 'textarea') return null;
      if (typeof readOnly !== 'boolean' || !isRecord(selection)) return null;
      const { start, end } = selection;
      if (!isOffset(start) || !isOffset(end) || end - start !== text.length) return null;
      return { status: 'captured', text, field, selection: { start, end }, readOnly };
    }

    default:
      return null;
  }
}
