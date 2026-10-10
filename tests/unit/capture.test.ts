import { describe, expect, it } from 'vitest';
import { parseCaptureResult } from '../../src/shared/capture.ts';

const valid = {
  status: 'captured',
  text: 'hello',
  field: 'textarea',
  selection: { start: 6, end: 11 },
  readOnly: false,
};

describe('parseCaptureResult', () => {
  // WB-UNIT-014
  it('accepts a well-formed capture', () => {
    expect(parseCaptureResult(valid)).toEqual(valid);
  });

  // WB-UNIT-015
  it('accepts each status that carries no data', () => {
    for (const status of ['empty-selection', 'no-field', 'sensitive-field']) {
      expect(parseCaptureResult({ status })).toEqual({ status });
    }
  });

  // WB-UNIT-016
  it('accepts each known unsupported reason and rejects others', () => {
    for (const reason of ['contenteditable', 'frame', 'input-type']) {
      expect(parseCaptureResult({ status: 'unsupported-field', reason })).toEqual({
        status: 'unsupported-field',
        reason,
      });
    }
    expect(parseCaptureResult({ status: 'unsupported-field', reason: 'canvas' })).toBeNull();
    expect(parseCaptureResult({ status: 'unsupported-field' })).toBeNull();
  });

  // WB-SEC-005
  it('drops fields it does not know, so nothing unexpected reaches the UI', () => {
    expect(parseCaptureResult({ ...valid, html: '<img src=x onerror=alert(1)>' })).toEqual(valid);
    expect(parseCaptureResult({ status: 'no-field', text: 'leak' })).toEqual({
      status: 'no-field',
    });
  });

  // WB-SEC-006
  it.each([
    ['null', null],
    ['a string', 'captured'],
    ['an array', [valid]],
    ['an unknown status', { status: 'ok' }],
    ['a missing status', {}],
    ['text that is not a string', { ...valid, text: 42 }],
    ['empty text', { ...valid, text: '', selection: { start: 0, end: 0 } }],
    ['an unknown field kind', { ...valid, field: 'div' }],
    ['readOnly that is not boolean', { ...valid, readOnly: 'no' }],
    ['a missing selection', { ...valid, selection: undefined }],
    ['a negative offset', { ...valid, selection: { start: -1, end: 4 } }],
    ['a fractional offset', { ...valid, selection: { start: 0.5, end: 5.5 } }],
    ['offsets that disagree with the text length', { ...valid, selection: { start: 0, end: 99 } }],
  ])('rejects %s', (_label, value) => {
    expect(parseCaptureResult(value)).toBeNull();
  });
});
