import { useEffect, useId, useState } from 'react';
import { MAX_INPUT_CHARACTERS } from '../shared/constants.ts';
import { getTextStats } from '../shared/text-stats.ts';
import { describeSelection } from './selection-message.ts';
import type { SelectionOutcome } from './selection-source.ts';

const numberFormat = new Intl.NumberFormat('en');

const TONE_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  success: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
} as const;

export interface AppProps {
  /** Reads the user's selection from the page. Injected so tests can fake it. */
  loadSelection: () => Promise<SelectionOutcome>;
}

export function App({ loadSelection }: AppProps) {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<SelectionOutcome | 'loading'>('loading');
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
        setText((current) => (current === '' ? outcome.text : current));
      }
    });
    return () => {
      active = false;
    };
  }, [loadSelection]);

  const message = describeSelection(selection);

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
            setText(event.target.value);
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

      <p className="text-xs text-slate-600 dark:text-slate-400">
        Writing actions are not available in this development build yet.
      </p>
    </main>
  );
}
