import { describe, expect, it } from 'vitest';
import {
  MAX_REQUEST_LENGTH,
  parseRequest,
  parseResponse,
} from '../../src/writing/local/protocol.ts';

const issue = {
  start: 0,
  end: 3,
  original: 'teh',
  category: 'spelling',
  message: 'Did you mean “the”?',
  replacements: ['the'],
  autoFix: true,
};

describe('parseRequest', () => {
  // WB-UNIT-034
  it('accepts prepare and check requests', () => {
    expect(parseRequest({ id: 1, type: 'prepare' })).toEqual({ id: 1, type: 'prepare' });
    expect(parseRequest({ id: 2, type: 'check', text: 'hi' })).toEqual({
      id: 2,
      type: 'check',
      text: 'hi',
    });
  });

  // WB-SEC-014
  it.each([
    ['null', null],
    ['no id', { type: 'prepare' }],
    ['a negative id', { id: -1, type: 'prepare' }],
    ['an unknown type', { id: 1, type: 'eval', text: '1+1' }],
    ['text that is not a string', { id: 1, type: 'check', text: 42 }],
    [
      'text over the size limit',
      { id: 1, type: 'check', text: 'a'.repeat(MAX_REQUEST_LENGTH + 1) },
    ],
  ])('rejects %s', (_label, value) => {
    expect(parseRequest(value)).toBeNull();
  });
});

describe('parseResponse', () => {
  // WB-UNIT-035
  it('accepts ready, error and result responses', () => {
    expect(parseResponse({ id: 1, type: 'ready' })).toEqual({ id: 1, type: 'ready' });
    expect(parseResponse({ id: 1, type: 'error' })).toEqual({ id: 1, type: 'error' });
    expect(parseResponse({ id: 1, type: 'result', issues: [issue] })).toEqual({
      id: 1,
      type: 'result',
      issues: [issue],
    });
  });

  // WB-UNIT-036
  it('drops unknown fields, including an error message that could echo text', () => {
    expect(parseResponse({ id: 1, type: 'error', message: 'secret draft' })).toEqual({
      id: 1,
      type: 'error',
    });
    const [parsed] = (
      parseResponse({ id: 1, type: 'result', issues: [{ ...issue, html: '<b>' }] }) as {
        issues: object[];
      }
    ).issues;
    expect(parsed).toEqual(issue);
  });

  // WB-SEC-015
  it.each([
    ['issues that are not an array', { id: 1, type: 'result', issues: 'none' }],
    ['an unknown category', { id: 1, type: 'result', issues: [{ ...issue, category: 'style' }] }],
    [
      'an end before its start',
      { id: 1, type: 'result', issues: [{ ...issue, start: 3, end: 0 }] },
    ],
    ['a length mismatch', { id: 1, type: 'result', issues: [{ ...issue, original: 'te' }] }],
    [
      'a non-string replacement',
      { id: 1, type: 'result', issues: [{ ...issue, replacements: [1] }] },
    ],
    ['a non-boolean autoFix', { id: 1, type: 'result', issues: [{ ...issue, autoFix: 'yes' }] }],
    ['a missing message', { id: 1, type: 'result', issues: [{ ...issue, message: undefined }] }],
    ['an unknown type', { id: 1, type: 'progress' }],
    ['no id', { type: 'ready' }],
  ])('rejects %s', (_label, value) => {
    expect(parseResponse(value)).toBeNull();
  });
});
