import { MAX_INPUT_CHARACTERS } from '../../shared/constants.ts';
import { DIALECTS, type Dialect, type Issue, type IssueCategory } from '../types.ts';

/**
 * Messages between the popup and the grammar worker.
 *
 * Both ends are WriteBetter's own code, but messages are still checked on
 * arrival: it keeps a bug on one side from turning into confusing behaviour
 * on the other, and the cost is negligible.
 */

export type WorkerRequest =
  { id: number; type: 'prepare' } | { id: number; type: 'check'; text: string; dialect: Dialect };

export type WorkerResponse =
  | { id: number; type: 'ready' }
  | { id: number; type: 'result'; issues: Issue[] }
  /** Deliberately carries no detail: an error message could echo text. */
  | { id: number; type: 'error' };

/** Generous upper bound on text length in UTF-16 units. MAX_INPUT_CHARACTERS
 *  counts graphemes, and one grapheme can be several units (an emoji with a
 *  skin tone is four). */
export const MAX_REQUEST_LENGTH = MAX_INPUT_CHARACTERS * 8;

const CATEGORIES: readonly string[] = [
  'spelling',
  'grammar',
  'punctuation',
  'capitalization',
] satisfies IssueCategory[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function parseRequest(value: unknown): WorkerRequest | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  if (value.type === 'prepare') return { id: value.id, type: 'prepare' };
  if (
    value.type === 'check' &&
    typeof value.text === 'string' &&
    value.text.length <= MAX_REQUEST_LENGTH &&
    typeof value.dialect === 'string' &&
    (DIALECTS as readonly string[]).includes(value.dialect)
  ) {
    return { id: value.id, type: 'check', text: value.text, dialect: value.dialect as Dialect };
  }
  return null;
}

function parseIssue(value: unknown): Issue | null {
  if (!isRecord(value)) return null;
  const { start, end, original, category, message, replacements, autoFix } = value;
  if (!isId(start) || !isId(end) || end < start) return null;
  if (typeof original !== 'string' || original.length !== end - start) return null;
  if (typeof category !== 'string' || !CATEGORIES.includes(category)) return null;
  if (typeof message !== 'string' || typeof autoFix !== 'boolean') return null;
  if (!Array.isArray(replacements) || !replacements.every((r) => typeof r === 'string')) {
    return null;
  }
  return {
    start,
    end,
    original,
    category: category as IssueCategory,
    message,
    replacements,
    autoFix,
  };
}

export function parseResponse(value: unknown): WorkerResponse | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  switch (value.type) {
    case 'ready':
      return { id: value.id, type: 'ready' };
    case 'error':
      return { id: value.id, type: 'error' };
    case 'result': {
      if (!Array.isArray(value.issues)) return null;
      const issues = value.issues.map(parseIssue);
      return issues.every((issue) => issue !== null)
        ? { id: value.id, type: 'result', issues }
        : null;
    }
    default:
      return null;
  }
}
