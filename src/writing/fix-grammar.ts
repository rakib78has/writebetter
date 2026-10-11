import { applyFixes } from './apply-fixes.ts';
import { applySafeguards } from './safeguards.ts';
import type { CheckOptions, GrammarChecker, Issue } from './types.ts';

export interface GrammarReport {
  /** The text that was checked. */
  original: string;
  /** The text with every safe fix applied. Equal to `original` when nothing
   *  was fixed. */
  corrected: string;
  /** Problems that were fixed in `corrected`. */
  fixed: Issue[];
  /** Problems found but left for the user to decide. */
  toReview: Issue[];
}

/**
 * The "Fix grammar" action: check, apply WriteBetter's safeguards, then
 * apply the fixes that are safe to make automatically. Style suggestions
 * are not mistakes and are left to "Polish style".
 */
export async function fixGrammar(
  checker: GrammarChecker,
  text: string,
  options: CheckOptions
): Promise<GrammarReport> {
  const issues = applySafeguards(text, await checker.check(text, options)).filter(
    (issue) => issue.category !== 'style'
  );
  const { text: corrected, applied, unresolved } = applyFixes(text, issues);
  return { original: text, corrected, fixed: applied, toReview: unresolved };
}
