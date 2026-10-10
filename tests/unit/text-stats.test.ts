import { describe, expect, it } from 'vitest';
import { MAX_INPUT_CHARACTERS } from '../../src/shared/constants.ts';
import { getTextStats } from '../../src/shared/text-stats.ts';

describe('getTextStats', () => {
  // WB-UNIT-001
  it('reports zero for empty text', () => {
    expect(getTextStats('')).toEqual({ characters: 0, words: 0, overLimit: false });
  });

  // WB-UNIT-002
  it('counts whitespace but no words for whitespace-only text', () => {
    expect(getTextStats(' \t\n ')).toEqual({ characters: 4, words: 0, overLimit: false });
  });

  // WB-UNIT-003
  it('counts words separated by any amount of whitespace', () => {
    expect(getTextStats('  Hello,\n\nworld!  How are\tyou? ').words).toBe(5);
  });

  // WB-UNIT-004
  it('counts an emoji with a skin-tone modifier as one character', () => {
    // "👋🏽" is four UTF-16 code units, which string.length would report.
    expect('👋🏽'.length).toBe(4);
    expect(getTextStats('👋🏽').characters).toBe(1);
  });

  // WB-UNIT-005
  it('counts a combining accent and a family emoji as single characters', () => {
    expect(getTextStats('é').characters).toBe(1);
    expect(getTextStats('👨‍👩‍👧').characters).toBe(1);
  });

  // WB-UNIT-006
  it('does not count punctuation or emoji alone as words', () => {
    expect(getTextStats('Great job 👏 — really !').words).toBe(3);
  });

  // WB-UNIT-007
  it('counts URLs, email addresses, hyphenated words and numbers as one word each', () => {
    const text = 'Email me@example.com or see https://example.com/a-b?c=1 about the e-mail 3.5';
    expect(getTextStats(text).words).toBe(9);
  });

  // WB-UNIT-008
  it('counts non-Latin scripts that use spaces', () => {
    expect(getTextStats('Привет мир').words).toBe(2);
    expect(getTextStats('مرحبا بالعالم').words).toBe(2);
  });

  // WB-UNIT-009
  it('treats text exactly at the limit as acceptable', () => {
    expect(getTextStats('a'.repeat(MAX_INPUT_CHARACTERS)).overLimit).toBe(false);
  });

  // WB-UNIT-010
  it('flags text one character over the limit', () => {
    const stats = getTextStats('a'.repeat(MAX_INPUT_CHARACTERS + 1));
    expect(stats.characters).toBe(MAX_INPUT_CHARACTERS + 1);
    expect(stats.overLimit).toBe(true);
  });

  // WB-UNIT-011
  it('measures the limit in characters, not UTF-16 code units', () => {
    // Each emoji is 4 code units, so string.length would be 4x the limit.
    expect(getTextStats('👋🏽'.repeat(MAX_INPUT_CHARACTERS)).overLimit).toBe(false);
  });
});
