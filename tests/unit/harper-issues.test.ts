import { describe, expect, it, vi } from 'vitest';
import {
  checkWithHarper,
  type HarperLint,
  type HarperSuggestion,
} from '../../src/writing/local/harper-issues.ts';

/**
 * Fake Harper objects. Each records whether it was freed, because Harper's
 * objects live in WebAssembly memory that only free() releases.
 */
const freed: string[] = [];

function fakeSuggestion(text: string, kind = 0): HarperSuggestion {
  return {
    get_replacement_text: () => text,
    kind: () => kind,
    free: () => freed.push(`suggestion:${text}`),
  };
}

function fakeLint(
  text: string,
  problem: string,
  kind: string,
  suggestions: HarperSuggestion[],
  { problemText = problem, message = `${kind} problem` } = {}
): HarperLint {
  const start = text.indexOf(problem);
  return {
    lint_kind: () => kind,
    message: () => message,
    span: () => ({ start, end: start + problem.length, free: () => freed.push(`span:${problem}`) }),
    get_problem_text: () => problemText,
    suggestions: () => suggestions,
    free: () => freed.push(`lint:${problem}`),
  };
}

/** A linter whose organizedLints() returns the given lints, keyed by rule. */
const linterReturning = (byRule: Record<string, HarperLint[]>) => ({
  organizedLints: vi.fn(() => Promise.resolve(byRule)),
});

describe('checkWithHarper', () => {
  // WB-UNIT-037
  it('converts lints to issues and lints the text as plain text', async () => {
    const text = 'This is teh end.';
    const linter = linterReturning({
      The: [fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the')])],
    });

    await expect(checkWithHarper(linter, text)).resolves.toEqual([
      {
        start: 8,
        end: 11,
        original: 'teh',
        category: 'spelling',
        message: 'Typo problem',
        replacements: ['the'],
        autoFix: true,
      },
    ]);
    expect(linter.organizedLints).toHaveBeenCalledWith(text, { language: 'plaintext' });
  });

  // WB-UNIT-038
  it.each([
    ['Spelling', 'spelling'],
    ['Capitalization', 'capitalization'],
    ['Punctuation', 'punctuation'],
    ['Agreement', 'grammar'],
    ['WordChoice', 'grammar'],
    ['Repetition', 'grammar'],
  ])('maps Harper kind %s to %s', async (kind, category) => {
    const text = 'word';
    const [issue] = await checkWithHarper(
      linterReturning({ SomeRule: [fakeLint(text, 'word', kind, [fakeSuggestion('ward')])] }),
      text
    );
    expect(issue?.category).toBe(category);
  });

  // WB-UNIT-039
  it.each(['Style', 'Readability', 'Enhancement', 'Redundancy', 'Regionalism', 'Formatting'])(
    'treats Harper kind %s as a style suggestion, never applied automatically',
    async (kind) => {
      const text = 'word';
      const [issue] = await checkWithHarper(
        linterReturning({ SomeRule: [fakeLint(text, 'word', kind, [fakeSuggestion('ward')])] }),
        text
      );
      expect(issue).toMatchObject({ category: 'style', autoFix: false });
    }
  );

  // WB-UNIT-060
  it.each([
    ['VeryUnique', 'WordChoice', 'Unique is absolute.'],
    ['AsSoonAsPossible', 'Miscellaneous', 'Expand this.'],
    ['ExpandDependencies', 'Miscellaneous', 'Expands deps.'],
    ['AnyRule', 'Grammar', '`X` is fine, but consider `Y`.'],
    ['AnyRule', 'Miscellaneous', 'Try expanding this initialism.'],
  ])(
    'treats rule %s (%s) with message "%s" as style, not a mistake',
    async (rule, kind, message) => {
      const text = 'word';
      const [issue] = await checkWithHarper(
        linterReturning({
          [rule]: [fakeLint(text, 'word', kind, [fakeSuggestion('ward')], { message })],
        }),
        text
      );
      expect(issue).toMatchObject({ category: 'style', autoFix: false });
    }
  );

  // WB-SEC-033
  it('drops lints from disabled rules that change correct English', async () => {
    const text = 'every one of them';
    const linter = linterReturning({
      Everyone: [fakeLint(text, 'every one', 'Miscellaneous', [fakeSuggestion('everyone')])],
    });
    await expect(checkWithHarper(linter, text)).resolves.toEqual([]);
  });

  // WB-UNIT-061
  it('returns issues from all rules in order of position', async () => {
    const text = 'teh cat and and dog';
    const linter = linterReturning({
      RepeatedWords: [fakeLint(text, 'and and', 'Repetition', [fakeSuggestion('and')])],
      The: [fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the')])],
    });
    const issues = await checkWithHarper(linter, text);
    expect(issues.map((issue) => issue.original)).toEqual(['teh', 'and and']);
  });

  // WB-UNIT-040
  it('turns remove and insert-after suggestions into full replacements', async () => {
    const text = 'and and done';
    const [remove] = await checkWithHarper(
      linterReturning({ R: [fakeLint(text, 'and ', 'Repetition', [fakeSuggestion('', 1)])] }),
      text
    );
    const [insert] = await checkWithHarper(
      linterReturning({ P: [fakeLint(text, 'done', 'Punctuation', [fakeSuggestion('.', 2)])] }),
      text
    );
    expect(remove?.replacements).toEqual(['']);
    expect(insert?.replacements).toEqual(['done.']);
  });

  // WB-UNIT-041
  it('keeps at most three distinct replacements that actually change the text', async () => {
    const text = 'teh';
    const suggestions = ['teh', 'the', 'the', 'tech', 'ten', 'tea'].map((s) => fakeSuggestion(s));
    const [issue] = await checkWithHarper(
      linterReturning({ SpellCheck: [fakeLint(text, 'teh', 'Spelling', suggestions)] }),
      text
    );
    expect(issue?.replacements).toEqual(['the', 'tech', 'ten']);
  });

  // WB-UNIT-042
  it('marks an issue with no replacement as not auto-fixable', async () => {
    const text = 'odd';
    const [issue] = await checkWithHarper(
      linterReturning({ G: [fakeLint(text, 'odd', 'Grammar', [])] }),
      text
    );
    expect(issue?.autoFix).toBe(false);
  });

  // WB-UNIT-043
  it('drops a lint whose offsets do not select the text it claims', async () => {
    const text = 'teh end';
    const linter = linterReturning({
      The: [fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the')], { problemText: 'xyz' })],
    });
    await expect(checkWithHarper(linter, text)).resolves.toEqual([]);
  });

  // WB-UNIT-044
  it('frees every lint, span and suggestion it reads, including dropped ones', async () => {
    freed.length = 0;
    const text = 'teh and and every one';
    await checkWithHarper(
      linterReturning({
        The: [fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the'), fakeSuggestion('tea')])],
        Everyone: [fakeLint(text, 'every one', 'Miscellaneous', [fakeSuggestion('everyone')])],
      }),
      text
    );
    expect(freed.sort()).toEqual(
      ['lint:every one', 'lint:teh', 'span:teh', 'suggestion:tea', 'suggestion:the'].sort()
    );
  });
});
