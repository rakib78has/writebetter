import { Dialect } from 'harper.js';
import { describe, expect, it } from 'vitest';
import { HARPER_DIALECT } from '../../src/writing/local/harper-issues.ts';
import { DIALECTS } from '../../src/writing/types.ts';

describe('HARPER_DIALECT', () => {
  // WB-UNIT-059
  it("matches harper.js's own Dialect enum, so an upgrade can't silently swap varieties", () => {
    expect(HARPER_DIALECT).toEqual({
      american: Dialect.American,
      british: Dialect.British,
      australian: Dialect.Australian,
      canadian: Dialect.Canadian,
      indian: Dialect.Indian,
    });
    expect(Object.keys(HARPER_DIALECT).sort()).toEqual([...DIALECTS].sort());
  });
});
