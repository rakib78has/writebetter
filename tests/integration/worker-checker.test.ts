import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerRequest, WorkerResponse } from '../../src/writing/local/protocol.ts';
import {
  createWorkerGrammarChecker,
  type WorkerLike,
} from '../../src/writing/local/worker-checker.ts';
import { GrammarCheckError, type Issue } from '../../src/writing/types.ts';

const AMERICAN = { dialect: 'american' } as const;

const ISSUE: Issue = {
  start: 0,
  end: 3,
  original: 'teh',
  category: 'spelling',
  message: 'typo',
  replacements: ['the'],
  autoFix: true,
};

type Responder = (request: WorkerRequest) => WorkerResponse | 'silent' | 'crash';

/** A fake worker that answers each request with `respond`, asynchronously. */
class FakeWorker implements WorkerLike {
  static created: FakeWorker[] = [];
  readonly received: WorkerRequest[] = [];
  terminated = false;
  private onMessage: (event: { data: unknown }) => void = () => undefined;
  private onError: () => void = () => undefined;

  constructor(private readonly respond: Responder) {
    FakeWorker.created.push(this);
  }

  addEventListener(type: 'message' | 'error', listener: (event: { data: unknown }) => void) {
    if (type === 'message') this.onMessage = listener;
    else this.onError = listener as () => void;
  }

  postMessage(request: WorkerRequest) {
    this.received.push(request);
    const response = this.respond(request);
    queueMicrotask(() => {
      if (response === 'crash') this.onError();
      else if (response !== 'silent') this.onMessage({ data: response });
    });
  }

  /** Lets a test send something the worker would never normally send. */
  sendRaw(data: unknown) {
    this.onMessage({ data });
  }

  terminate() {
    this.terminated = true;
  }
}

const healthy: Responder = (request) =>
  request.type === 'prepare'
    ? { id: request.id, type: 'ready' }
    : { id: request.id, type: 'result', issues: [ISSUE] };

function checkerWith(...responders: Responder[]) {
  let index = 0;
  return createWorkerGrammarChecker(
    () => new FakeWorker(responders[Math.min(index++, responders.length - 1)] ?? healthy),
    { prepareTimeoutMs: 1_000, checkTimeoutMs: 500 }
  );
}

beforeEach(() => {
  FakeWorker.created = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('worker grammar checker', () => {
  // WB-INT-029
  it('starts the worker lazily, prepares it once, and returns issues', async () => {
    const checker = checkerWith(healthy);
    expect(FakeWorker.created).toHaveLength(0);

    await expect(checker.check('teh', AMERICAN)).resolves.toEqual([ISSUE]);
    await checker.check('teh', AMERICAN);

    expect(FakeWorker.created).toHaveLength(1);
    expect(FakeWorker.created[0]?.received.map((r) => r.type)).toEqual([
      'prepare',
      'check',
      'check',
    ]);
  });

  // WB-INT-030
  it('shares one preparation between overlapping calls', async () => {
    const checker = checkerWith(healthy);
    await Promise.all([checker.prepare(), checker.prepare(), checker.check('a', AMERICAN)]);
    expect(FakeWorker.created[0]?.received.filter((r) => r.type === 'prepare')).toHaveLength(1);
  });

  // WB-INT-031
  it('rejects with "unavailable" when the worker fails to load, then recovers', async () => {
    const checker = checkerWith(() => 'crash', healthy);

    const failure = await checker.check('teh', AMERICAN).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GrammarCheckError);
    expect((failure as GrammarCheckError).reason).toBe('unavailable');
    expect(FakeWorker.created[0]?.terminated).toBe(true);

    // The next attempt starts a fresh worker instead of staying broken.
    await expect(checker.check('teh', AMERICAN)).resolves.toEqual([ISSUE]);
    expect(FakeWorker.created).toHaveLength(2);
  });

  // WB-INT-032
  it('rejects with "unavailable" when the engine reports an error', async () => {
    const checker = checkerWith((request) =>
      request.type === 'prepare'
        ? { id: request.id, type: 'ready' }
        : { id: request.id, type: 'error' }
    );
    await expect(checker.check('teh', AMERICAN)).rejects.toMatchObject({ reason: 'unavailable' });
  });

  // WB-INT-033
  it('rejects with "timeout" when the worker stops answering, then recovers', async () => {
    vi.useFakeTimers();
    const checker = checkerWith(
      (request) => (request.type === 'prepare' ? { id: request.id, type: 'ready' } : 'silent'),
      healthy
    );

    const pending = checker.check('teh', AMERICAN).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(500);

    expect(await pending).toMatchObject({ reason: 'timeout' });
    expect(FakeWorker.created[0]?.terminated).toBe(true);

    vi.useRealTimers();
    await expect(checker.check('teh', AMERICAN)).resolves.toEqual([ISSUE]);
  });

  // WB-INT-034
  it('times out a preparation that never finishes', async () => {
    vi.useFakeTimers();
    const checker = checkerWith(() => 'silent');

    const pending = checker.prepare().catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(await pending).toMatchObject({ reason: 'timeout' });
  });

  // WB-INT-035
  it('ignores malformed or unexpected messages from the worker', async () => {
    const checker = checkerWith(healthy);
    await checker.prepare();
    const worker = FakeWorker.created[0];

    worker?.sendRaw('garbage');
    worker?.sendRaw({ id: 999, type: 'ready' });
    worker?.sendRaw({ id: 1, type: 'result', issues: [{ bogus: true }] });

    await expect(checker.check('teh', AMERICAN)).resolves.toEqual([ISSUE]);
  });

  // WB-SEC-016
  it('never puts the checked text in an error message', async () => {
    const checker = checkerWith(() => 'crash');
    const failure = await checker
      .check('my confidential draft', AMERICAN)
      .catch((error: unknown) => error);
    expect((failure as Error).message).not.toContain('confidential');
  });
});
