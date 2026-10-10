import { describe, expect, it, vi } from 'vitest';
import { createRequestHandler } from '../../src/writing/local/worker-handler.ts';

function fakeLinter({ setupFails = false, lintFails = false } = {}) {
  return {
    setup: vi.fn(() => (setupFails ? Promise.reject(new Error('wasm')) : Promise.resolve())),
    lint: vi.fn(() =>
      lintFails ? Promise.reject(new Error('my draft text')) : Promise.resolve([])
    ),
  };
}

describe('grammar worker request handler', () => {
  // WB-UNIT-045
  it('answers prepare with ready once the engine is set up', async () => {
    const linter = fakeLinter();
    await expect(createRequestHandler(linter)({ id: 1, type: 'prepare' })).resolves.toEqual({
      id: 1,
      type: 'ready',
    });
    expect(linter.setup).toHaveBeenCalledOnce();
  });

  // WB-UNIT-046
  it('answers check with the issues found', async () => {
    await expect(
      createRequestHandler(fakeLinter())({ id: 2, type: 'check', text: 'fine' })
    ).resolves.toEqual({ id: 2, type: 'result', issues: [] });
  });

  // WB-UNIT-047
  it('answers a failure with a bare error that cannot leak text', async () => {
    const response = await createRequestHandler(fakeLinter({ lintFails: true }))({
      id: 3,
      type: 'check',
      text: 'my draft text',
    });
    expect(response).toEqual({ id: 3, type: 'error' });

    await expect(
      createRequestHandler(fakeLinter({ setupFails: true }))({ id: 4, type: 'prepare' })
    ).resolves.toEqual({ id: 4, type: 'error' });
  });

  // WB-UNIT-048
  it('answers a malformed request that has an id with an error, so the caller fails fast', async () => {
    await expect(createRequestHandler(fakeLinter())({ id: 5, type: 'eval' })).resolves.toEqual({
      id: 5,
      type: 'error',
    });
  });

  // WB-UNIT-049
  it('ignores a message with no usable id', async () => {
    const handle = createRequestHandler(fakeLinter());
    await expect(handle(null)).resolves.toBeNull();
    await expect(handle({ type: 'prepare' })).resolves.toBeNull();
    await expect(handle({ id: 'x', type: 'prepare' })).resolves.toBeNull();
  });
});
