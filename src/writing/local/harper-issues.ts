import type { Dialect, Issue, IssueCategory } from '../types.ts';

/**
 * Converts Harper's lints into WriteBetter Issues.
 *
 * This is the only module that knows Harper's types. The shapes below are
 * the parts of harper.js it uses, declared here so tests can pass plain
 * objects and the rest of the code never imports harper.js.
 *
 * Harper's results live in WebAssembly memory, which JavaScript's garbage
 * collector cannot reclaim. Every Lint, Span and Suggestion read here is
 * freed once copied.
 */

interface Freeable {
  free(): void;
}
export interface HarperSuggestion extends Freeable {
  get_replacement_text(): string;
  /** 0 = replace, 1 = remove, 2 = insert after the problem text. */
  kind(): number;
}
export interface HarperLint extends Freeable {
  lint_kind(): string;
  message(): string;
  span(): Freeable & { start: number; end: number };
  get_problem_text(): string;
  suggestions(): HarperSuggestion[];
}
export interface HarperLinter {
  lint(text: string, options: { language: 'plaintext' }): Promise<HarperLint[]>;
}

/** Harper's Dialect enum values (harper.js 2.x). */
export const HARPER_DIALECT: Readonly<Record<Dialect, number>> = {
  american: 0,
  british: 1,
  australian: 2,
  canadian: 3,
  indian: 4,
};

/**
 * Harper's lint kinds that are errors, by WriteBetter category. Kinds not
 * listed (Style, Readability, Enhancement, Redundancy, Regionalism,
 * Nonstandard, Formatting, WordOrder) are matters of taste, not mistakes,
 * and are not reported by "Fix grammar".
 */
const CATEGORY_BY_KIND: Readonly<Record<string, IssueCategory>> = {
  Spelling: 'spelling',
  Typo: 'spelling',
  Capitalization: 'capitalization',
  Punctuation: 'punctuation',
  Agreement: 'grammar',
  BoundaryError: 'grammar',
  Eggcorn: 'grammar',
  Grammar: 'grammar',
  Malapropism: 'grammar',
  Miscellaneous: 'grammar',
  Repetition: 'grammar',
  Usage: 'grammar',
  WordChoice: 'grammar',
};

const MAX_REPLACEMENTS = 3;
const SUGGESTION_REMOVE = 1;
const SUGGESTION_INSERT_AFTER = 2;

/** Turns a Harper suggestion into the full text that replaces the problem. */
function replacementFor(suggestion: HarperSuggestion, original: string): string {
  const text = suggestion.get_replacement_text();
  switch (suggestion.kind()) {
    case SUGGESTION_REMOVE:
      return '';
    case SUGGESTION_INSERT_AFTER:
      return original + text;
    default:
      return text;
  }
}

function toIssue(lint: HarperLint, text: string): Issue | null {
  const category = CATEGORY_BY_KIND[lint.lint_kind()];
  const span = lint.span();
  const { start, end } = span;
  span.free();
  // harper.js reports UTF-16 offsets. Checking that they select the text it
  // says they do catches any change to that in a future version.
  const original = text.slice(start, end);
  if (!category || original !== lint.get_problem_text()) return null;

  const suggestions = lint.suggestions();
  const replacements = [
    ...new Set(suggestions.map((suggestion) => replacementFor(suggestion, original))),
  ]
    .filter((replacement) => replacement !== original)
    .slice(0, MAX_REPLACEMENTS);
  for (const suggestion of suggestions) suggestion.free();

  return {
    start,
    end,
    original,
    category,
    message: lint.message(),
    replacements,
    autoFix: replacements.length > 0,
  };
}

/** Lints `text` as plain text (not Markdown) and returns its issues. */
export async function checkWithHarper(linter: HarperLinter, text: string): Promise<Issue[]> {
  const lints = await linter.lint(text, { language: 'plaintext' });
  try {
    return lints.map((lint) => toIssue(lint, text)).filter((issue) => issue !== null);
  } finally {
    for (const lint of lints) lint.free();
  }
}
