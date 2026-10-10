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
  problemText = problem
): HarperLint {
  const start = text.indexOf(problem);
  return {
    lint_kind: () => kind,
    message: () => `${kind} problem`,
    span: () => ({ start, end: start + problem.length, free: () => freed.push(`span:${problem}`) }),
    get_problem_text: () => problemText,
    suggestions: () => suggestions,
    free: () => freed.push(`lint:${problem}`),
  };
}

const linterReturning = (lints: HarperLint[]) => ({ lint: vi.fn(() => Promise.resolve(lints)) });

describe('checkWithHarper', () => {
  // WB-UNIT-037
  it('converts lints to issues and lints the text as plain text', async () => {
    const text = 'This is teh end.';
    const linter = linterReturning([fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the')])]);

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
    expect(linter.lint).toHaveBeenCalledWith(text, { language: 'plaintext' });
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
      linterReturning([fakeLint(text, 'word', kind, [fakeSuggestion('ward')])]),
      text
    );
    expect(issue?.category).toBe(category);
  });

  // WB-UNIT-039
  it.each(['Style', 'Readability', 'Enhancement', 'Redundancy', 'Regionalism', 'Formatting'])(
    'ignores Harper kind %s, which is taste rather than an error',
    async (kind) => {
      const text = 'word';
      const linter = linterReturning([fakeLint(text, 'word', kind, [fakeSuggestion('ward')])]);
      await expect(checkWithHarper(linter, text)).resolves.toEqual([]);
    }
  );

  // WB-UNIT-040
  it('turns remove and insert-after suggestions into full replacements', async () => {
    const text = 'and and done';
    const [remove] = await checkWithHarper(
      linterReturning([fakeLint(text, 'and ', 'Repetition', [fakeSuggestion('', 1)])]),
      text
    );
    const [insert] = await checkWithHarper(
      linterReturning([fakeLint(text, 'done', 'Punctuation', [fakeSuggestion('.', 2)])]),
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
      linterReturning([fakeLint(text, 'teh', 'Spelling', suggestions)]),
      text
    );
    expect(issue?.replacements).toEqual(['the', 'tech', 'ten']);
  });

  // WB-UNIT-042
  it('marks an issue with no replacement as not auto-fixable', async () => {
    const text = 'odd';
    const [issue] = await checkWithHarper(
      linterReturning([fakeLint(text, 'odd', 'Grammar', [])]),
      text
    );
    expect(issue?.autoFix).toBe(false);
  });

  // WB-UNIT-043
  it('drops a lint whose offsets do not select the text it claims', async () => {
    const text = 'teh end';
    const linter = linterReturning([fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the')], 'xyz')]);
    await expect(checkWithHarper(linter, text)).resolves.toEqual([]);
  });

  // WB-UNIT-044
  it('frees every lint, span and suggestion it reads', async () => {
    freed.length = 0;
    const text = 'teh and and';
    await checkWithHarper(
      linterReturning([
        fakeLint(text, 'teh', 'Typo', [fakeSuggestion('the'), fakeSuggestion('tea')]),
        fakeLint(text, 'and and', 'Style', [fakeSuggestion('and')]),
      ]),
      text
    );
    expect(freed.sort()).toEqual(
      [
        'lint:and and',
        'lint:teh',
        'span:and and',
        'span:teh',
        'suggestion:tea',
        'suggestion:the',
      ].sort()
    );
  });
});
