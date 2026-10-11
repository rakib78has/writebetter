import { checkWithHarper, HARPER_DIALECT, type HarperLinter } from './harper-issues.ts';
import { parseRequest, type WorkerResponse } from './protocol.ts';

/**
 * The grammar worker's logic, kept apart from the worker entry point
 * (grammar.worker.ts) so it can be tested without a real worker.
 */
export function createRequestHandler(
  linter: HarperLinter & { setup(): Promise<void>; setDialect(dialect: number): Promise<void> }
) {
  // Harper starts in American English. Switching is instant, but skipped
  // when nothing changed.
  let dialect = HARPER_DIALECT.american;
  return async (data: unknown): Promise<WorkerResponse | null> => {
    const request = parseRequest(data);
    if (!request) {
      // Answer a malformed request that still has an id, so the caller fails
      // fast instead of waiting for its timeout.
      const id = (data as { id?: unknown } | null)?.id;
      return typeof id === 'number' && Number.isSafeInteger(id) && id >= 0
        ? { id, type: 'error' }
        : null;
    }

    try {
      if (request.type === 'prepare') {
        await linter.setup();
        return { id: request.id, type: 'ready' };
      }
      const wanted = HARPER_DIALECT[request.dialect];
      if (wanted !== dialect) {
        await linter.setDialect(wanted);
        dialect = wanted;
      }
      return {
        id: request.id,
        type: 'result',
        issues: await checkWithHarper(linter, request.text),
      };
    } catch {
      return { id: request.id, type: 'error' };
    }
  };
}
