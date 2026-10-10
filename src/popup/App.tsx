import { useEffect, useId, useRef, useState } from 'react';
import { MAX_INPUT_CHARACTERS } from '../shared/constants.ts';
import { getTextStats } from '../shared/text-stats.ts';
import { fixGrammar, type GrammarReport } from '../writing/fix-grammar.ts';
import { GrammarCheckError, type GrammarChecker } from '../writing/types.ts';
import { GrammarResults } from './components/GrammarResults.tsx';
import { describeSelection } from './selection-message.ts';
import type { SelectionOutcome } from './selection-source.ts';

const numberFormat = new Intl.NumberFormat('en');

const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
} as const;

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; report: GrammarReport }
  | { status: 'error'; message: string };

export interface AppProps {
  /** Reads the user's selection from the page. Injected so tests can fake it. */
  loadSelection: () => Promise<SelectionOutcome>;
  /** The grammar engine. Injected so tests can fake it. */
  grammar: GrammarChecker;
}

export function App({ loadSelection, grammar }: AppProps) {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<SelectionOutcome | 'loading'>('loading');
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  // The latest text, readable from inside an async callback, so a result for
  // text the user has since edited can be recognised as stale and dropped.
  const latestText = useRef(text);
  const stats = getTextStats(text);
  const inputId = useId();
  const statsId = useId();

  useEffect(() => {
    let active = true;
    void loadSelection().then((outcome) => {
      if (!active) return;
      setSelection(outcome);
      // Never overwrite what the user has already started typing.
      if (outcome.status === 'captured') {
        setText((current) => {
          const next = current === '' ? outcome.text : current;
          latestText.current = next;
          return next;
        });
      }
    });
    return () => {
      active = false;
    };
  }, [loadSelection]);

  function updateText(next: string) {
    latestText.current = next;
    setText(next);
    // Results describe the text as it was; once it changes they are stale.
    setCheck({ status: 'idle' });
  }

  async function runFixGrammar() {
    const snapshot = text;
    setCheck({ status: 'checking' });
    try {
      const report = await fixGrammar(grammar, snapshot);
      if (latestText.current === snapshot) setCheck({ status: 'done', report });
    } catch (error) {
      if (latestText.current !== snapshot) return;
      const timeout = error instanceof GrammarCheckError && error.reason === 'timeout';
      setCheck({
        status: 'error',
        message: timeout
          ? 'The grammar checker took too long. Please try again.'
          : 'The grammar checker couldn’t start. Close WriteBetter and open it again.',
      });
    }
  }

  const message = describeSelection(selection);
  const canCheck = text.trim() !== '' && !stats.overLimit && check.status !== 'checking';

  return (
    <main className="flex w-[360px] flex-col gap-3 bg-white p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header>
        <h1 className="text-lg font-semibold">WriteBetter</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Your text stays on this device.
        </p>
      </header>

      <p role="status" className={`rounded-md p-2 text-xs ${TONE_CLASSES[message.tone]}`}>
        {message.text}
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          Text to improve
        </label>
        <textarea
          id={inputId}
          value={text}
          onChange={(event) => {
            updateText(event.target.value);
          }}
          aria-describedby={statsId}
          aria-invalid={stats.overLimit}
          rows={6}
          spellCheck={false}
          placeholder="Type or paste your text here"
          className="resize-y rounded-md border border-slate-300 bg-white p-2 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 aria-invalid:border-red-600 dark:border-slate-600 dark:bg-slate-800"
        />
        <p id={statsId} className="text-xs text-slate-600 dark:text-slate-400">
          {numberFormat.format(stats.words)} {stats.words === 1 ? 'word' : 'words'} ·{' '}
          {numberFormat.format(stats.characters)} / {numberFormat.format(MAX_INPUT_CHARACTERS)}{' '}
          characters
        </p>
        {stats.overLimit && (
          <p role="alert" className="text-xs text-red-700 dark:text-red-400">
            This text is too long. Shorten it to {numberFormat.format(MAX_INPUT_CHARACTERS)}{' '}
            characters or fewer.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          void runFixGrammar();
        }}
        disabled={!canCheck}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {check.status === 'checking' ? 'Checking…' : 'Fix grammar'}
      </button>

      {/* Announces progress to screen readers; results follow below it. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {check.status === 'checking' && (
          <p className="text-xs text-slate-600 dark:text-slate-400">Checking your text…</p>
        )}
        {check.status === 'done' && <GrammarResults report={check.report} />}
      </div>
      {check.status === 'error' && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300"
        >
          {check.message}
        </p>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Grammar checking runs on your device and supports English only. It can miss problems, so
        give the result a read.
      </p>
    </main>
  );
}
