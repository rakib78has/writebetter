/**
 * Replacing text in the page's focused field, after the user confirms.
 *
 * The request names the exact text expected at the given offsets. The page
 * refuses to change anything if that text is no longer there, so newer edits
 * by the user are never overwritten.
 */

export interface ReplaceRequest {
  /** UTF-16 offsets in the field's value, as captured. */
  start: number;
  end: number;
  /** What must currently be at [start, end) for the replacement to go ahead. */
  expected: string;
  replacement: string;
}

export type ReplaceResult =
  | { status: 'replaced' }
  /** The field no longer holds `expected` at those offsets. */
  | { status: 'changed' }
  /** No supported text field has focus any more. */
  | { status: 'field-gone' }
  | { status: 'read-only' }
  /** The result would exceed the field's maxlength. Nothing was changed. */
  | { status: 'too-long' }
  /** The browser did not apply the change. */
  | { status: 'failed' };

const STATUSES: readonly string[] = [
  'replaced',
  'changed',
  'field-gone',
  'read-only',
  'too-long',
  'failed',
] satisfies ReplaceResult['status'][];

/** Checks a result returned by the page. Anything unexpected is `failed`. */
export function parseReplaceResult(value: unknown): ReplaceResult {
  const status = (value as { status?: unknown } | null)?.status;
  return typeof status === 'string' && STATUSES.includes(status)
    ? ({ status } as ReplaceResult)
    : { status: 'failed' };
}
