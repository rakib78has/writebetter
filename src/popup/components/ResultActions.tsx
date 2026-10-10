import { useEffect, useRef, useState } from 'react';
import type { ReplaceRequest, RichFix } from '../../shared/replace.ts';
import type { ReplaceOutcome } from '../page-access.ts';

/** Where the corrected text would go on the page, or why it can't. */
export type ReplaceTarget =
  /** An <input> or <textarea>: the selected range is replaced in one edit. */
  | { kind: 'text-field'; start: number; end: number; original: string }
  /** A rich-text editor: each fix is applied where it is, keeping formatting. */
  | { kind: 'rich'; original: string; fixes: RichFix[] }
  | { kind: 'unavailable'; reason: 'typed' | 'read-only' | 'edited' };

export interface ResultActionsProps {
  corrected: string;
  target: ReplaceTarget;
  replaceText: (request: ReplaceRequest) => Promise<ReplaceOutcome>;
  copyText: (text: string) => Promise<void>;
}

type ReplaceState =
  | { step: 'idle' }
  | { step: 'confirming' }
  | { step: 'working' }
  | { step: 'replaced' }
  | { step: 'undone' }
  | { step: 'partial'; applied: number; total: number }
  | { step: 'unexpected'; applied: number }
  | { step: 'error'; message: string };

type Refusal = Exclude<ReplaceOutcome['status'], 'replaced' | 'partial' | 'unexpected'>;

const NOT_REPLACED: Record<Refusal, string> = {
  changed:
    'The text on the page has changed since WriteBetter read it, so nothing was replaced. Copy the corrected text instead.',
  'field-gone':
    'The text box on the page is no longer selected, so nothing was replaced. Copy the corrected text instead.',
  'read-only': 'That text box can’t be edited, so nothing was replaced.',
  'too-long': 'The corrected text is longer than that text box allows, so nothing was replaced.',
  failed: 'The page didn’t accept the change. Copy the corrected text instead.',
  'page-unavailable':
    'WriteBetter can no longer reach that page, so nothing was replaced. Copy the corrected text instead.',
};

const UNAVAILABLE: Record<Extract<ReplaceTarget, { kind: 'unavailable' }>['reason'], string> = {
  typed: 'To replace text on a page, select it there and open WriteBetter.',
  'read-only': 'The selected text box is read-only, so the text can only be copied.',
  edited:
    'You edited the text here, so it no longer matches the editor on the page. Copy it instead.',
};

const BUTTON =
  'rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50';
const PRIMARY = `${BUTTON} bg-indigo-600 text-white hover:bg-indigo-700`;
const SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100`;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Copy, and replace-on-page with an explicit confirmation step and undo.
 *
 * Nothing on the page changes until the user has clicked "Replace on page"
 * and then "Yes, replace".
 */
export function ResultActions({ corrected, target, replaceText, copyText }: ResultActionsProps) {
  const [replace, setReplace] = useState<ReplaceState>({ step: 'idle' });
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const confirmButton = useRef<HTMLButtonElement>(null);

  // Move focus into the confirmation so keyboard users land on it.
  useEffect(() => {
    if (replace.step === 'confirming') confirmButton.current?.focus();
  }, [replace.step]);

  async function runCopy() {
    try {
      await copyText(corrected);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  async function run(request: ReplaceRequest, success: 'replaced' | 'undone') {
    setReplace({ step: 'working' });
    const outcome = await replaceText(request);
    if (outcome.status === 'replaced') setReplace({ step: success });
    else if (outcome.status === 'partial') setReplace({ step: 'partial', ...outcome });
    else if (outcome.status === 'unexpected') setReplace({ step: 'unexpected', ...outcome });
    else setReplace({ step: 'error', message: NOT_REPLACED[outcome.status] });
  }

  function confirm() {
    if (target.kind === 'text-field') {
      void run(
        {
          kind: 'text-field',
          start: target.start,
          end: target.end,
          expected: target.original,
          replacement: corrected,
        },
        'replaced'
      );
    } else if (target.kind === 'rich') {
      void run({ kind: 'rich', expected: target.original, fixes: target.fixes }, 'replaced');
    }
  }

  function undo() {
    // Only text fields get an Undo button: the edit is one known range that
    // can be put back exactly. Rich editors keep their own undo history.
    if (target.kind !== 'text-field') return;
    void run(
      {
        kind: 'text-field',
        start: target.start,
        end: target.start + corrected.length,
        expected: corrected,
        replacement: target.original,
      },
      'undone'
    );
  }

  const canReplace = target.kind !== 'unavailable';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={SECONDARY}
          onClick={() => {
            void runCopy();
          }}
        >
          Copy
        </button>
        {canReplace && (replace.step === 'idle' || replace.step === 'undone') && (
          <button
            type="button"
            className={PRIMARY}
            onClick={() => {
              setReplace({ step: 'confirming' });
            }}
          >
            Replace on page
          </button>
        )}
      </div>

      <p aria-live="polite" className="text-xs text-slate-600 dark:text-slate-400">
        {copy === 'copied' && 'Copied to the clipboard.'}
        {copy === 'failed' && 'Couldn’t copy. Select the corrected text and press Ctrl+C.'}
      </p>

      {target.kind === 'unavailable' && (
        <p className="text-xs text-slate-600 dark:text-slate-400">{UNAVAILABLE[target.reason]}</p>
      )}

      {canReplace && replace.step === 'confirming' && (
        <div
          role="group"
          aria-label="Confirm replacement"
          className="flex flex-col gap-2 rounded-md border border-indigo-300 bg-indigo-50 p-2 text-xs dark:border-indigo-700 dark:bg-indigo-950"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setReplace({ step: 'idle' });
          }}
        >
          <p>
            {target.kind === 'rich'
              ? `Make ${target.fixes.length === 1 ? 'this change' : `these ${target.fixes.length} changes`} in the text you selected on the page? Formatting such as bold text and links is kept.`
              : 'Replace the text you selected on the page with the corrected text?'}
          </p>
          <div className="flex gap-2">
            <button ref={confirmButton} type="button" className={PRIMARY} onClick={confirm}>
              Yes, replace
            </button>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => {
                setReplace({ step: 'idle' });
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div aria-live="polite" className="text-xs">
        {replace.step === 'working' && <p>Updating the page…</p>}
        {replace.step === 'undone' && <p>The original text is back on the page.</p>}
        {replace.step === 'replaced' && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <p className="flex-1">
              Replaced on the page.
              {target.kind === 'rich' && ' To undo, press Ctrl+Z in the editor, once per change.'}
            </p>
            {target.kind === 'text-field' && (
              <button type="button" className={SECONDARY} onClick={undo}>
                Undo
              </button>
            )}
          </div>
        )}
      </div>
      {replace.step === 'partial' && (
        <p
          role="alert"
          className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          Made {replace.applied} of {plural(replace.total, 'change', 'changes')}. The rest were
          skipped because that part of the text had changed or spans a line break. Press Ctrl+Z in
          the editor to undo, or copy the corrected text instead.
        </p>
      )}
      {replace.step === 'unexpected' && (
        <p
          role="alert"
          className="rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-300"
        >
          The editor didn’t apply a change where WriteBetter expected, so it stopped.
          {replace.applied > 0 &&
            ` ${plural(replace.applied, 'change was', 'changes were')} made correctly before that.`}{' '}
          Check the text on the page, and press Ctrl+Z in the editor to undo anything that looks
          wrong.
        </p>
      )}
      {replace.step === 'error' && (
        <p
          role="alert"
          className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {replace.message}
        </p>
      )}
    </div>
  );
}
