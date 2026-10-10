import { describe, expect, it } from 'vitest';
import { applyFixes } from '../../src/writing/apply-fixes.ts';
import type { Issue } from '../../src/writing/types.ts';

/** Builds an issue for `original` found at its first position in `text`. */
function issueIn(text: string, original: string, replacements: string[], autoFix = true): Issue {
  const start = text.indexOf(original);
  if (start < 0) throw new Error(`"${original}" is not in "${text}"`);
  return {
    start,
    end: start + original.length,
    original,
    category: 'grammar',
    message: 'test',
    replacements,
    autoFix,
  };
}

describe('applyFixes', () => {
  // WB-UNIT-020
  it('returns the text unchanged when there are no issues', () => {
    expect(applyFixes('All good.', [])).toEqual({ text: 'All good.', applied: [], unresolved: [] });
  });

  // WB-UNIT-021
  it('applies several fixes, whatever order the issues arrive in', () => {
    const text = 'I has a apple.';
    const has = issueIn(text, 'has', ['have']);
    const a = issueIn(text, ' a ', [' an ']);
    const result = applyFixes(text, [a, has]);

    expect(result.text).toBe('I have an apple.');
    expect(result.applied).toEqual([has, a]);
  });

  // WB-UNIT-022
  it('uses only the first replacement', () => {
    const text = 'teh end';
    expect(applyFixes(text, [issueIn(text, 'teh', ['the', 'tech'])]).text).toBe('the end');
  });

  // WB-UNIT-023
  it('supports a replacement that removes text', () => {
    const text = 'and and the rest';
    expect(applyFixes(text, [issueIn(text, 'and and', ['and'])]).text).toBe('and the rest');
    expect(applyFixes(text, [issueIn(text, 'and ', [''])]).text).toBe('and the rest');
  });

  // WB-UNIT-024
  it('leaves issues that are not safe to auto-fix, or have no replacement, for review', () => {
    const text = 'Rakib wrote teh note';
    const name = issueIn(text, 'Rakib', ['Rabbi'], false);
    const vague = issueIn(text, 'note', []);
    const typo = issueIn(text, 'teh', ['the']);
    const result = applyFixes(text, [name, vague, typo]);

    expect(result.text).toBe('Rakib wrote the note');
    expect(result.applied).toEqual([typo]);
    expect(result.unresolved).toEqual([name, vague]);
  });

  // WB-UNIT-025
  it('applies only the first of two overlapping fixes', () => {
    const text = 'could of been';
    const wide = issueIn(text, 'could of', ['could have']);
    const narrow = issueIn(text, 'of', ['have']);
    const result = applyFixes(text, [narrow, wide]);

    expect(result.text).toBe('could have been');
    expect(result.applied).toEqual([wide]);
    expect(result.unresolved).toEqual([narrow]);
  });

  // WB-UNIT-026
  it('refuses an issue whose offsets do not match the text', () => {
    const text = 'teh end';
    const stale = { ...issueIn(text, 'teh', ['the']), original: 'xyz' };
    const outOfRange = { ...issueIn(text, 'end', ['finish']), start: 4, end: 99 };
    const result = applyFixes(text, [stale, outOfRange]);

    expect(result.text).toBe(text);
    expect(result.unresolved).toEqual([stale, outOfRange]);
  });

  // WB-UNIT-027
  it('keeps emoji and other multi-unit characters around a fix intact', () => {
    const text = 'Hi 👋🏽 teh 👨‍👩‍👧 end';
    expect(applyFixes(text, [issueIn(text, 'teh', ['the'])]).text).toBe('Hi 👋🏽 the 👨‍👩‍👧 end');
  });
});
