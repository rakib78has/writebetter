import { describe, expect, it } from 'vitest';
import { parseReplaceResult } from '../../src/shared/replace.ts';

describe('parseReplaceResult', () => {
  // WB-UNIT-052
  it.each(['replaced', 'changed', 'field-gone', 'read-only', 'too-long', 'failed'])(
    'accepts status %s and nothing else',
    (status) => {
      expect(parseReplaceResult({ status, extra: 'dropped' })).toEqual({ status });
    }
  );

  // WB-SEC-023
  it.each([null, undefined, 'replaced', {}, { status: 'ok' }, { status: 1 }])(
    'turns %j into a failure',
    (value) => {
      expect(parseReplaceResult(value)).toEqual({ status: 'failed' });
    }
  );
});
