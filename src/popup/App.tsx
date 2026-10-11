import { useEffect, useId, useRef, useState } from 'react';
import { MAX_INPUT_CHARACTERS } from '../shared/constants.ts';
import { getTextStats } from '../shared/text-stats.ts';
import { fixGrammar, type GrammarReport } from '../writing/fix-grammar.ts';
import { polishStyle, type StyleReport } from '../writing/polish-style.ts';
import {
  GrammarCheckError,
  type Dialect,
  type GrammarChecker,
  type Issue,
} from '../writing/types.ts';
import type { Settings } from '../settings/settings.ts';
import type { ReplaceRequest } from '../shared/replace.ts';
import { GrammarResults } from './components/GrammarResults.tsx';
import { StyleResults } from './components/StyleResults.tsx';
import type { ReplaceTarget } from './components/ResultActions.tsx';
import type { ReplaceOutcome, SelectionOutcome } from './page-access.ts';
import { describeSelection } from './selection-message.ts';

const numberFormat = new Intl.NumberFormat('en');

const DIALECT_NAMES: Readonly<Record<Dialect, string>> = {
  american: 'American',
  british: 'British',
  australian: 'Australian',
  canadian: 'Canadian',
  indian: 'Indian',
};

const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
} as const;

type Action = 'grammar' | 'style';

type CheckState =
  | { status: 'idle' }
  | { status: 'checking'; action: Action }
  /** `run` identifies the check, so each result starts with fresh actions. */
  | { status: 'done'; report: GrammarReport; run: number }
  | { status: 'style'; report: StyleReport; run: number }
  | { status: 'error'; message: string };

export interface AppProps {
  /** Reads the user's selection from the page. Injected so tests can fake it. */
  loadSelection: () => Promise<SelectionOutcome>;
  /** The grammar engine. Injected so tests can fake it. */
  grammar: GrammarChecker;
  /** Replaces text in the page's field, after the user confirms. */
  replaceText: (request: ReplaceRequest) => Promise<ReplaceOutcome>;
  /** Puts text on the clipboard. */
  copyText: (text: string) => Promise<void>;
  /** Reads and saves the user's preferences. */
  settings: {
    load: () => Promise<Settings>;
    save: (settings: Settings) => Promise<void>;
  };
}

/**
 * Where a result could be written back, given how the text was obtained.
 * `original` is the text that was checked; `applied` the changes made.
 */
function replaceTargetFor(
  selection: SelectionOutcome | 'loading',
  original: string,
  applied: readonly Issue[]
): ReplaceTarget {
  if (selection === 'loading' || selection.status !== 'captured') {
    return { kind: 'unavailable', reason: 'typed' };
  }
  if (selection.field === 'rich') {
    // Fixes are applied in place, at offsets into the checked text, so that
    // text must be exactly what the editor holds.
    if (original !== selection.text) return { kind: 'unavailable', reason: 'edited' };
    return {
      kind: 'rich',
      original: selection.text,
      fixes: applied.map(({ start, end, original, replacements }) => ({
        start,
        end,
        original,
        replacement: replacements[0] ?? '',
      })),
    };
  }
  if (selection.readOnly) return { kind: 'unavailable', reason: 'read-only' };
  return {
    kind: 'text-field',
    start: selection.selection.start,
    end: selection.selection.end,
    original: selection.text,
  };
}

export function App({ loadSelection, grammar, replaceText, copyText, settings }: AppProps) {
  const [text, setText] = useState('');
  // Null until loaded (a few milliseconds), so a check never runs with a
  // dialect the user didn't choose.
  const [dialect, setDialect] = useState<Dialect | null>(null);
  const latestDialect = useRef<Dialect | null>(null);
  const [selection, setSelection] = useState<SelectionOutcome | 'loading'>('loading');
  const [check, setCheck] = useState<CheckState>({ status: 'idle' });
  // The latest text, readable from inside an async callback, so a result for
  // text the user has since edited can be recognised as stale and dropped.
  const latestText = useRef(text);
  const runs = useRef(0);
  const stats = getTextStats(text);
  const inputId = useId();
  const statsId = useId();
  const dialectId = useId();

  useEffect(() => {
    let active = true;
    void settings.load().then((loaded) => {
      if (!active) return;
      latestDialect.current = loaded.dialect;
      setDialect(loaded.dialect);
    });
    return () => {
      active = false;
    };
  }, [settings]);

  function changeDialect(next: Dialect) {
    latestDialect.current = next;
    setDialect(next);
    // A result checked against the previous variety no longer applies.
    setCheck({ status: 'idle' });
    void settings.save({ dialect: next }).catch(() => {
      // Not saving only means the choice isn't remembered next time; the
      // current check still uses it, so there is nothing to tell the user.
    });
  }

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

  async function run(action: Action) {
    if (dialect === null) return;
    const snapshot = text;
    const checkedDialect = dialect;
    const isCurrent = () =>
      latestText.current === snapshot && latestDialect.current === checkedDialect;
    setCheck({ status: 'checking', action });
    try {
      const options = { dialect: checkedDialect };
      if (action === 'grammar') {
        const report = await fixGrammar(grammar, snapshot, options);
        if (isCurrent()) setCheck({ status: 'done', report, run: ++runs.current });
      } else {
        const report = await polishStyle(grammar, snapshot, options);
        if (isCurrent()) setCheck({ status: 'style', report, run: ++runs.current });
      }
    } catch (error) {
      if (!isCurrent()) return;
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
  const canCheck =
    text.trim() !== '' && !stats.overLimit && check.status !== 'checking' && dialect !== null;

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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            void run('grammar');
          }}
          disabled={!canCheck}
          className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {check.status === 'checking' && check.action === 'grammar' ? 'Checking…' : 'Fix grammar'}
        </button>
        <button
          type="button"
          onClick={() => {
            void run('style');
          }}
          disabled={!canCheck}
          className="flex-1 rounded-md border border-indigo-600 bg-white px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
        >
          {check.status === 'checking' && check.action === 'style' ? 'Checking…' : 'Polish style'}
        </button>
      </div>
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor={dialectId} className="text-xs text-slate-600 dark:text-slate-400">
            English variant
          </label>
          <select
            id={dialectId}
            value={dialect ?? ''}
            disabled={dialect === null}
            onChange={(event) => {
              changeDialect(event.target.value as Dialect);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-2 focus:outline-offset-1 focus:outline-indigo-600 dark:border-slate-600 dark:bg-slate-800"
          >
            {dialect === null && <option value="">Loading…</option>}
            {Object.entries(DIALECT_NAMES).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Announces progress to screen readers; results follow below it. */}
      <div aria-live="polite" className="flex flex-col gap-2">
        {check.status === 'checking' && (
          <p className="text-xs text-slate-600 dark:text-slate-400">Checking your text…</p>
        )}
        {check.status === 'done' && (
          <GrammarResults
            key={check.run}
            report={check.report}
            target={replaceTargetFor(selection, check.report.original, check.report.fixed)}
            replaceText={replaceText}
            copyText={copyText}
          />
        )}
        {check.status === 'style' && (
          <StyleResults
            key={check.run}
            report={check.report}
            targetFor={(applied) => replaceTargetFor(selection, check.report.original, applied)}
            replaceText={replaceText}
            copyText={copyText}
          />
        )}
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
