/**
 * Replacing text in the page, after the user confirms.
 *
 * Every request names the exact text expected on the page. The page refuses
 * to change anything if that text is no longer there, so newer edits by the
 * user are never overwritten.
 */

export type ReplaceRequest = TextFieldReplace | RichReplace;

/** Replace a range of an <input> or <textarea> value in one edit. */
export interface TextFieldReplace {
  kind: 'text-field';
  /** UTF-16 offsets in the field's value, as captured. */
  start: number;
  end: number;
  /** What must currently be at [start, end) for the replacement to go ahead. */
  expected: string;
  replacement: string;
}

/**
 * Apply individual fixes inside the selection of a rich-text editor.
 *
 * Replacing the whole selection at once would strip bold, links and other
 * formatting inside it, and turn line breaks into extra paragraphs. Editing
 * only the words that change leaves everything around them as it was.
 */
export interface RichReplace {
  kind: 'rich';
  /** The selected text, as captured. The page must still show exactly this. */
  expected: string;
  /** Offsets are into `expected`. */
  fixes: RichFix[];
}

export interface RichFix {
  start: number;
  end: number;
  original: string;
  replacement: string;
}

export type ReplaceResult =
  | { status: 'replaced' }
  /** Some fixes were made, then the editor's text no longer matched, so the
   *  rest were skipped rather than risk editing the wrong place. */
  | { status: 'partial'; applied: number; total: number }
  /** The editor did not apply a change where expected. WriteBetter stopped
   *  at once; `applied` earlier changes were made correctly. */
  | { status: 'unexpected'; applied: number }
  /** The page no longer holds the expected text. Nothing was changed. */
  | { status: 'changed' }
  /** No supported field or editor has focus any more. */
  | { status: 'field-gone' }
  | { status: 'read-only' }
  /** The result would exceed the field's maxlength. Nothing was changed. */
  | { status: 'too-long' }
  /** The browser or editor did not apply the change. */
  | { status: 'failed' };

const SIMPLE_STATUSES: readonly string[] = [
  'replaced',
  'changed',
  'field-gone',
  'read-only',
  'too-long',
  'failed',
] satisfies Exclude<ReplaceResult['status'], 'partial' | 'unexpected'>[];

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** Checks a result returned by the page. Anything unexpected is `failed`. */
export function parseReplaceResult(value: unknown): ReplaceResult {
  const record = (typeof value === 'object' && value !== null ? value : {}) as Record<
    string,
    unknown
  >;
  const { status, applied, total } = record;
  if (status === 'partial' && isCount(applied) && isCount(total) && applied < total) {
    return { status, applied, total };
  }
  if (status === 'unexpected' && isCount(applied)) return { status, applied };
  return typeof status === 'string' && SIMPLE_STATUSES.includes(status)
    ? ({ status } as ReplaceResult)
    : { status: 'failed' };
}
