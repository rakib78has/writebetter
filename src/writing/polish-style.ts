import { applyFixes } from './apply-fixes.ts';
import { applySafeguards } from './safeguards.ts';
import type { CheckOptions, GrammarChecker, Issue } from './types.ts';

export interface StyleReport {
  /** The text that was checked. */
  original: string;
  /** Style suggestions, in order of position. Each has at least one
   *  replacement. None is applied until the user picks it. */
  suggestions: Issue[];
}

/**
 * The "Polish style" action: style suggestions only (wordiness, initialisms,
 * absolute adjectives and the like), never mistakes, which "Fix grammar"
 * handles. WriteBetter's safeguards apply, so nothing in a URL, code or a
 * name is touched.
 */
export async function polishStyle(
  checker: GrammarChecker,
  text: string,
  options: CheckOptions
): Promise<StyleReport> {
  const suggestions = applySafeguards(text, await checker.check(text, options)).filter(
    (issue) => issue.category === 'style' && issue.replacements.length > 0
  );
  return { original: text, suggestions };
}

/**
 * Applies the suggestions the user picked, using each one's first
 * replacement. Overlapping picks keep the first, as in Fix grammar.
 */
export function applySuggestions(report: StyleReport, picked: readonly Issue[]) {
  const { text, applied } = applyFixes(
    report.original,
    picked.map((issue) => ({ ...issue, autoFix: true }))
  );
  return { corrected: text, applied };
}
