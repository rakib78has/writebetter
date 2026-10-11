import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { fixGrammar } from '../../src/writing/fix-grammar.ts';
import { applySuggestions, polishStyle } from '../../src/writing/polish-style.ts';
import type { GrammarChecker } from '../../src/writing/types.ts';
import { createNodeGrammarChecker } from '../helpers/harper-node.ts';

/**
 * Accuracy regression suite: the real Harper engine, through the full
 * "Fix grammar" pipeline including WriteBetter's safeguards. Output is
 * deterministic because the engine version is pinned, so exact results are
 * asserted. Cases live in tests/fixtures/grammar-cases.json.
 */

interface Cases {
  fixed: { id: string; text: string; corrected: string }[];
  knownMisses: { id: string; text: string }[];
  reviewNotFixed: { id: string; text: string; review: string[]; corrected?: string }[];
  clean: { id: string; text: string }[];
  style: { id: string; text: string; suggestions: string[] }[];
}

const cases = JSON.parse(
  readFileSync(new URL('../fixtures/grammar-cases.json', import.meta.url), 'utf8')
) as Cases;

const AMERICAN = { dialect: 'american' } as const;

let checker: GrammarChecker;
beforeAll(async () => {
  checker = await createNodeGrammarChecker();
}, 60_000);

describe('Fix grammar with Harper', () => {
  // WB-INT-024
  it.each(cases.fixed.map((c) => [c.id, c] as const))('corrects %s', async (_id, c) => {
    const report = await fixGrammar(checker, c.text, AMERICAN);
    expect(report.corrected).toBe(c.corrected);
    expect(report.toReview).toEqual([]);
  });

  // WB-INT-025
  it.each(cases.knownMisses.map((c) => [c.id, c] as const))(
    'still misses %s (known limitation; update the fixture if this starts passing)',
    async (_id, c) => {
      const report = await fixGrammar(checker, c.text, AMERICAN);
      expect(report.corrected).toBe(c.text);
    }
  );

  // WB-INT-026
  it.each(cases.reviewNotFixed.map((c) => [c.id, c] as const))(
    'leaves %s for the user to review instead of changing it',
    async (_id, c) => {
      const report = await fixGrammar(checker, c.text, AMERICAN);
      expect(report.corrected).toBe(c.corrected ?? c.text);
      expect(report.toReview.map((issue) => issue.original)).toEqual(c.review);
    }
  );

  // WB-INT-027
  it.each(cases.clean.map((c) => [c.id, c] as const))(
    'reports nothing in clean text: %s',
    async (_id, c) => {
      const report = await fixGrammar(checker, c.text, AMERICAN);
      expect(report.fixed).toEqual([]);
      expect(report.toReview).toEqual([]);
    }
  );

  // WB-INT-028
  it('checks 5,000 characters quickly enough for an interactive popup', async () => {
    const text = cases.fixed
      .map((c) => c.text)
      .join(' ')
      .repeat(20)
      .slice(0, 5000);
    const started = performance.now();
    const report = await fixGrammar(checker, text, AMERICAN);
    const elapsed = performance.now() - started;

    expect(report.fixed.length).toBeGreaterThan(0);
    // Measured at ~60 ms in Chromium. The bound is loose so a slow CI
    // machine doesn't fail it; it exists to catch an order-of-magnitude
    // regression, not to benchmark.
    expect(elapsed).toBeLessThan(2_000);
  });

  // WB-SEC-013
  it('returns markup in the text as plain text, unchanged', async () => {
    const text = '<img src=x onerror=alert(1)> teh end';
    const report = await fixGrammar(checker, text, AMERICAN);
    expect(report.corrected).toBe('<img src=x onerror=alert(1)> the end');
  });

  // WB-INT-061
  it.each([
    [
      'american',
      'The colour of the organisation was analysed.',
      'The color of the organization was analyzed.',
    ],
    [
      'british',
      'The colour of the organisation was analysed.',
      'The colour of the organisation was analysed.',
    ],
    ['british', 'The color of the center was fine.', 'The colour of the centre was fine.'],
    [
      'australian',
      'The colour of the organisation was analysed.',
      'The colour of the organisation was analysed.',
    ],
    [
      'canadian',
      'The colour of the organisation was analysed.',
      'The colour of the organization was analyzed.',
    ],
  ] as const)('respects %s spelling: %s', async (dialect, text, corrected) => {
    const report = await fixGrammar(checker, text, { dialect });
    expect(report.corrected).toBe(corrected);
  });

  // WB-INT-062
  it.each(cases.style.map((c) => [c.id, c] as const))(
    'leaves style alone in Fix grammar and offers it in Polish style: %s',
    async (_id, c) => {
      const fixed = await fixGrammar(checker, c.text, AMERICAN);
      expect(fixed.corrected).toBe(c.text);
      expect(fixed.toReview).toEqual([]);

      const style = await polishStyle(checker, c.text, AMERICAN);
      expect(style.suggestions.map((issue) => issue.original)).toEqual(c.suggestions);
      expect(style.suggestions.every((issue) => !issue.autoFix)).toBe(true);
    }
  );

  // WB-INT-063
  it('applies only the style suggestions the user picks', async () => {
    const text = 'It is a very unique design, so reply ASAP.';
    const report = await polishStyle(checker, text, AMERICAN);
    const asap = report.suggestions.filter((issue) => issue.original === 'ASAP');

    expect(applySuggestions(report, []).corrected).toBe(text);
    expect(applySuggestions(report, asap).corrected).toBe(
      'It is a very unique design, so reply As soon as possible.'
    );
  });
});
