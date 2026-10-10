/**
 * The result of reading the user's selection from a web page.
 *
 * Produced by runInPage() inside the page and returned to the popup. The
 * page is not trusted, so the popup checks the shape with
 * parseCaptureResult() before using it.
 */
export type CaptureResult =
  | TextFieldCapture
  | RichCapture
  /** Focus is in a supported field or editor, but nothing is selected. */
  | { status: 'empty-selection' }
  /** Focus is not in a text field or editor at all. */
  | { status: 'no-field' }
  /** A password, one-time-code or payment field. Its value is never read. */
  | { status: 'sensitive-field' }
  /** The selection is far over the length limit. It was not read. */
  | { status: 'too-long' }
  /** A text-editing surface WriteBetter does not support. */
  | { status: 'unsupported-field'; reason: UnsupportedReason };

/** Text selected in an <input> or <textarea>. */
export interface TextFieldCapture {
  status: 'captured';
  text: string;
  field: 'input' | 'textarea';
  /** Offsets of the selection in the field's value, for replacing it later. */
  selection: { start: number; end: number };
  /** The field can be read but not edited. */
  readOnly: boolean;
}

/** Text selected in a rich-text editor (a contenteditable element). Line and
 *  paragraph breaks are represented as "\n". */
export interface RichCapture {
  status: 'captured';
  text: string;
  field: 'rich';
  readOnly: false;
}

export type UnsupportedReason = 'frame' | 'input-type';

const UNSUPPORTED_REASONS: readonly string[] = [
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
    case 'too-long':
      return { status: value.status };

    case 'unsupported-field':
      return typeof value.reason === 'string' && UNSUPPORTED_REASONS.includes(value.reason)
        ? { status: 'unsupported-field', reason: value.reason as UnsupportedReason }
        : null;

    case 'captured': {
      const { text, field, selection, readOnly } = value;
      if (typeof text !== 'string' || text.length === 0) return null;
      if (field === 'rich') {
        return readOnly === false ? { status: 'captured', text, field, readOnly } : null;
      }
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
