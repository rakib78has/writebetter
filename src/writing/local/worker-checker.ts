import { GrammarCheckError, type CheckOptions, type GrammarChecker, type Issue } from '../types.ts';
import { parseResponse, type WorkerRequest, type WorkerResponse } from './protocol.ts';

/** The parts of a Worker this module uses, so tests can supply a fake. */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  terminate(): void;
}

export interface WorkerCheckerOptions {
  /** Loading and compiling Harper takes 1–2 s on a typical machine. */
  prepareTimeoutMs?: number;
  /** Checking 5,000 characters takes well under 100 ms. */
  checkTimeoutMs?: number;
}

interface Pending {
  resolve: (response: WorkerResponse) => void;
  reject: (error: GrammarCheckError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * A GrammarChecker backed by the grammar worker.
 *
 * The worker is created on first use. If it fails to load, or a request
 * times out, it is discarded and the next call starts a fresh one, so one
 * failure does not leave the popup permanently broken.
 */
export function createWorkerGrammarChecker(
  createWorker: () => WorkerLike,
  { prepareTimeoutMs = 30_000, checkTimeoutMs = 15_000 }: WorkerCheckerOptions = {}
): GrammarChecker {
  let worker: WorkerLike | null = null;
  let ready: Promise<void> | null = null;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  function reset(reason: GrammarCheckError['reason']) {
    worker?.terminate();
    worker = null;
    ready = null;
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(new GrammarCheckError(reason));
    }
    pending.clear();
  }

  function getWorker(): WorkerLike {
    if (worker) return worker;
    const created = createWorker();
    created.addEventListener('message', ({ data }) => {
      const response = parseResponse(data);
      const request = response && pending.get(response.id);
      if (!response || !request) return;
      pending.delete(response.id);
      clearTimeout(request.timer);
      request.resolve(response);
    });
    // Fires when the worker script or the WebAssembly fails to load.
    created.addEventListener('error', () => {
      if (worker === created) reset('unavailable');
    });
    worker = created;
    return created;
  }

  function send(request: WorkerRequest, timeoutMs: number): Promise<WorkerResponse> {
    const target = getWorker();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (worker === target) reset('timeout');
      }, timeoutMs);
      pending.set(request.id, { resolve, reject, timer });
      target.postMessage(request);
    });
  }

  function prepare(): Promise<void> {
    ready ??= send({ id: nextId++, type: 'prepare' }, prepareTimeoutMs).then((response) => {
      if (response.type !== 'ready') throw new GrammarCheckError('unavailable');
    });
    const attempt = ready;
    // Forget a failed attempt so the next call can try again.
    attempt.catch(() => {
      if (ready === attempt) ready = null;
    });
    return attempt;
  }

  async function check(text: string, { dialect }: CheckOptions): Promise<Issue[]> {
    await prepare();
    const response = await send({ id: nextId++, type: 'check', text, dialect }, checkTimeoutMs);
    if (response.type !== 'result') throw new GrammarCheckError('unavailable');
    return response.issues;
  }

  return { prepare, check };
}
