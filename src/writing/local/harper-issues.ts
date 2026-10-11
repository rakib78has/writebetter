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
  /** Lints grouped by the name of the Harper rule that produced them. */
  organizedLints(
    text: string,
    options: { language: 'plaintext' }
  ): Promise<Record<string, HarperLint[]>>;
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
 * Harper rules whose output is dropped entirely, because tests showed them
 * changing correct English. Each needs a regression case in
 * tests/fixtures/grammar-cases.json.
 */
const DISABLED_RULES: ReadonlySet<string> = new Set([
  // Turns the correct "every one of the participants" into "everyone of".
  'Everyone',
]);

/**
 * Harper rules that offer a matter of taste, not a fix for a mistake. They
 * go to "Polish style" as suggestions and are never applied automatically.
 * Rules whose message reads as advice ("consider…", "try…") are treated
 * the same way, so a new rule like these is caught without being listed.
 */
const STYLE_RULES: ReadonlySet<string> = new Set([
  // "very unique" → "very special": changes the meaning.
  'VeryUnique',
  // "ASAP" → "As soon as possible": both are correct.
  'AsSoonAsPossible',
]);
const ADVICE = /\bconsider\b|^try\b/i;

/** Harper's lint kinds for matters of style rather than mistakes. */
const STYLE_KINDS: ReadonlySet<string> = new Set([
  'Enhancement',
  'Formatting',
  'Nonstandard',
  'Readability',
  'Redundancy',
  'Regionalism',
  'Style',
  'WordOrder',
]);

/** Harper's lint kinds for mistakes, by WriteBetter category. */
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

/** Which WriteBetter category a lint belongs to, or null to drop it. */
function categorise(rule: string, kind: string, message: string): IssueCategory | null {
  if (DISABLED_RULES.has(rule)) return null;
  if (STYLE_RULES.has(rule) || STYLE_KINDS.has(kind) || rule.startsWith('Expand')) return 'style';
  if (ADVICE.test(message)) return 'style';
  return CATEGORY_BY_KIND[kind] ?? null;
}

function toIssue(lint: HarperLint, text: string, rule: string): Issue | null {
  const message = lint.message();
  const category = categorise(rule, lint.lint_kind(), message);
  if (!category) return null;
  const span = lint.span();
  const { start, end } = span;
  span.free();
  // harper.js reports UTF-16 offsets. Checking that they select the text it
  // says they do catches any change to that in a future version.
  const original = text.slice(start, end);
  if (original !== lint.get_problem_text()) return null;

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
    message,
    replacements,
    // Style suggestions are only ever applied when the user picks them.
    autoFix: category !== 'style' && replacements.length > 0,
  };
}

/** Lints `text` as plain text (not Markdown) and returns its issues, in
 *  order of position. */
export async function checkWithHarper(linter: HarperLinter, text: string): Promise<Issue[]> {
  const byRule = await linter.organizedLints(text, { language: 'plaintext' });
  const issues: Issue[] = [];
  try {
    for (const [rule, lints] of Object.entries(byRule)) {
      for (const lint of lints) {
        const issue = toIssue(lint, text, rule);
        if (issue) issues.push(issue);
      }
    }
  } finally {
    for (const lints of Object.values(byRule)) for (const lint of lints) lint.free();
  }
  return issues.sort((a, b) => a.start - b.start || a.end - b.end);
}
