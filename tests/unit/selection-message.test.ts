import { describe, expect, it } from 'vitest';
import { describeSelection } from '../../src/popup/selection-message.ts';
import type { SelectionOutcome } from '../../src/popup/page-access.ts';

const captured: SelectionOutcome = {
  status: 'captured',
  text: 'hi',
  field: 'input',
  selection: { start: 0, end: 2 },
  readOnly: false,
};

describe('describeSelection', () => {
  // WB-UNIT-017
  it.each<[string, SelectionOutcome | 'loading', string, RegExp]>([
    ['loading', 'loading', 'neutral', /reading your selection/i],
    ['a capture', captured, 'success', /^Loaded the text you selected\.$/],
    ['a read-only capture', { ...captured, readOnly: true }, 'success', /read-only/],
    ['an empty selection', { status: 'empty-selection' }, 'neutral', /no text is selected/i],
    ['no field', { status: 'no-field' }, 'neutral', /select text in a text box/i],
    ['a sensitive field', { status: 'sensitive-field' }, 'warning', /never reads password/i],
    [
      'a frame',
      { status: 'unsupported-field', reason: 'frame' },
      'warning',
      /embedded frames.*paste/i,
    ],
    [
      'an unsupported input type',
      { status: 'unsupported-field', reason: 'input-type' },
      'warning',
      /field isn’t supported.*paste/i,
    ],
    ['a restricted page', { status: 'page-unavailable' }, 'neutral', /can’t read this page/i],
    ['a failure', { status: 'failed' }, 'warning', /something went wrong/i],
  ])('explains %s', (_label, outcome, tone, text) => {
    const message = describeSelection(outcome);
    expect(message.tone).toBe(tone);
    expect(message.text).toMatch(text);
  });

  // WB-SEC-007
  it('never repeats the captured text in the message', () => {
    const secret = { ...captured, text: 'my private note' };
    expect(describeSelection(secret).text).not.toContain('my private note');
  });
});
