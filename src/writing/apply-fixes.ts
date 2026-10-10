import type { Issue } from './types.ts';

export interface FixResult {
  /** The text with every applied fix. */
  text: string;
  /** Issues whose first replacement was applied. */
  applied: Issue[];
  /** Issues left for the user: not safe to auto-fix, no replacement, or
   *  overlapping an issue that was already fixed. */
  unresolved: Issue[];
}

/**
 * Applies the first replacement of every auto-fixable issue.
 *
 * Fixes are applied from the start of the text to the end. When two issues
 * overlap, only the first is applied, because the second's offsets no
 * longer describe the text once the first has changed it.
 */
export function applyFixes(text: string, issues: readonly Issue[]): FixResult {
  const sorted = [...issues].sort((a, b) => a.start - b.start || a.end - b.end);
  const applied: Issue[] = [];
  const unresolved: Issue[] = [];
  const parts: string[] = [];
  let cursor = 0;

  for (const issue of sorted) {
    const replacement = issue.replacements[0];
    const valid =
      issue.start >= cursor &&
      issue.end <= text.length &&
      issue.start <= issue.end &&
      text.slice(issue.start, issue.end) === issue.original;

    if (!issue.autoFix || replacement === undefined || !valid) {
      unresolved.push(issue);
      continue;
    }

    parts.push(text.slice(cursor, issue.start), replacement);
    cursor = issue.end;
    applied.push(issue);
  }

  parts.push(text.slice(cursor));
  return { text: parts.join(''), applied, unresolved };
}
