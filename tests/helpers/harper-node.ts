import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createBinaryModuleFromUrl, Dialect as HarperDialect, LocalLinter } from 'harper.js';
import { checkWithHarper } from '../../src/writing/local/harper-issues.ts';
import type { Dialect, GrammarChecker } from '../../src/writing/types.ts';

// Harper's own enum values. The production mapping (HARPER_DIALECT, used by
// the worker) is checked against these in harper-dialect.test.ts.
const DIALECT: Record<Dialect, HarperDialect> = {
  american: HarperDialect.American,
  british: HarperDialect.British,
  australian: HarperDialect.Australian,
  canadian: HarperDialect.Canadian,
  indian: HarperDialect.Indian,
};

/**
 * The real Harper engine, running in Node, behind the same GrammarChecker
 * interface the popup uses. Lets accuracy tests run without a browser.
 *
 * The WebAssembly is passed as a data: URL. harper.js's own Node loader
 * mangles Windows paths (it reads `new URL(path).pathname`, giving
 * `/C:/...`), whereas Node's fetch reads a data: URL on every platform.
 */
export async function createNodeGrammarChecker(): Promise<GrammarChecker> {
  const wasmUrl = import.meta
    .resolve('harper.js/slimBinary')
    .replace(/slimBinary\.js$/, 'harper_wasm_slim_bg.wasm');
  const bytes = await readFile(fileURLToPath(wasmUrl));
  const binary = createBinaryModuleFromUrl(
    `data:application/wasm;base64,${bytes.toString('base64')}`,
    'slim'
  );
  const linter = new LocalLinter({ binary });
  await linter.setup();
  return {
    prepare: () => Promise.resolve(),
    check: async (text, { dialect }) => {
      await linter.setDialect(DIALECT[dialect]);
      return checkWithHarper(linter, text);
    },
  };
}
