import type { Issue } from './types.ts';

/**
 * Text a grammar checker should leave alone: it isn't prose, so "errors"
 * found in it are false positives, and "fixing" them would break it.
 *
 * - URLs and email addresses
 * - @mentions and #hashtags
 * - `code` in backticks
 * - HTML or XML tags (<img src=x>), which a checker would otherwise "fix"
 *   into nonsense ("img" → "i mg", "src" → "sac")
 * - Identifiers, paths and file names: letters and digits joined by `_`,
 *   `/`, `\` or `.`, containing at least one letter (constants.ts,
 *   MAX_INPUT, src/popup/App.tsx, e.g.). A plain number such as 3.50 is
 *   not matched.
 */
const PROTECTED_PATTERNS: readonly RegExp[] = [
  /\b[a-z][a-z0-9+.-]*:\/\/\S+/giu,
  /\bwww\.\S+/giu,
  /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.\p{L}{2,}/gu,
  /(?:^|\s)[@#][\p{L}\p{N}_]+/gu,
  /`[^`\n]+`/gu,
  /<\/?[a-z][^<>\n]*>/giu,
  /(?=[\p{L}\p{N}_/\\.]*\p{L})[\p{L}\p{N}]+(?:[_/\\.][\p{L}\p{N}]+)+/gu,
];

export interface Range {
  start: number;
  end: number;
}

/** Finds the ranges of `text` covered by PROTECTED_PATTERNS. */
export function findProtectedRanges(text: string): Range[] {
  const ranges: Range[] = [];
  for (const pattern of PROTECTED_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return ranges;
}

const overlaps = (a: Range, b: Range) => a.start < b.end && b.start < a.end;
const HAS_UPPERCASE = /\p{Lu}/u;

/**
 * Applies WriteBetter's safety rules to an engine's raw issues:
 *
 * 1. Issues touching protected text (URLs, emails, code, identifiers) are
 *    dropped entirely.
 * 2. A spelling "fix" to a word containing a capital letter is never applied
 *    automatically. Such words are usually names or acronyms the dictionary
 *    doesn't know ("Rakib", "Siobhan"), and replacing them silently would
 *    change the meaning. The issue is still shown for the user to judge.
 * 3. The first word is never capitalised automatically. Users often select
 *    part of a sentence ("their is a problem" from "Dear team, their is a
 *    problem"), and the engine can't tell a fragment from a sentence.
 *    The lone pronoun "i" is the exception: it is wrong anywhere.
 */
export function applySafeguards(text: string, issues: readonly Issue[]): Issue[] {
  const protectedRanges = findProtectedRanges(text);
  const firstWordStart = text.search(/\S/u);

  return issues
    .filter((issue) => !protectedRanges.some((range) => overlaps(range, issue)))
    .map((issue) => {
      const capitalisedName = issue.category === 'spelling' && HAS_UPPERCASE.test(issue.original);
      const capitalisesFirstWord =
        issue.category === 'capitalization' &&
        issue.start === firstWordStart &&
        issue.original !== 'i';
      return capitalisedName || capitalisesFirstWord ? { ...issue, autoFix: false } : issue;
    });
}
