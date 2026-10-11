import { useId, useState } from 'react';
import { applySuggestions, type StyleReport } from '../../writing/polish-style.ts';
import type { Issue } from '../../writing/types.ts';
import { ChangeView } from './ChangeView.tsx';
import { ResultActions, type ResultActionsProps, type ReplaceTarget } from './ResultActions.tsx';

export type StyleResultsProps = {
  report: StyleReport;
  /** Where the picked changes could be written back. */
  targetFor: (applied: Issue[]) => ReplaceTarget;
} & Omit<ResultActionsProps, 'corrected' | 'target'>;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Shows "Polish style" suggestions as choices. Nothing is applied until the
 * user ticks it; the changes and the corrected text update as they do.
 */
export function StyleResults({ report, targetFor, ...actions }: StyleResultsProps) {
  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  const correctedId = useId();
  const { suggestions } = report;

  if (suggestions.length === 0) {
    return (
      <p className="rounded-md bg-slate-100 p-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        No style suggestions. Style checks are rule-based and catch only some patterns, such as
        wordy phrases and absolute adjectives.
      </p>
    );
  }

  const chosen = suggestions.filter((_, index) => picked.has(index));
  const { corrected, applied } = applySuggestions(report, chosen);

  function toggle(index: number) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section aria-label="Style suggestions" className="flex flex-col gap-2 text-xs">
      <h2 className="text-sm font-medium">
        {plural(suggestions.length, 'style suggestion', 'style suggestions')}
      </h2>
      <p className="text-slate-600 dark:text-slate-400">
        These are matters of taste, not mistakes. Tick the ones you want.
      </p>
      <ul className="flex flex-col gap-1.5">
        {suggestions.map((issue, index) => {
          const [replacement = ''] = issue.replacements;
          return (
            <li key={`${issue.start}-${issue.end}`} className="flex flex-col gap-0.5">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={picked.has(index)}
                  onChange={() => {
                    toggle(index);
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{issue.original}</span>
                  {' → '}
                  <span className="font-medium">
                    {replacement === '' ? '(remove)' : replacement}
                  </span>
                </span>
              </label>
              <span className="pl-5 text-slate-600 dark:text-slate-400">{issue.message}</span>
            </li>
          );
        })}
      </ul>

      {applied.length > 0 && (
        <div className="flex flex-col gap-1">
          <ChangeView original={report.original} fixed={applied} />
          <label htmlFor={correctedId} className="mt-1 text-sm font-medium">
            Corrected text
          </label>
          <textarea
            id={correctedId}
            value={corrected}
            readOnly
            rows={4}
            className="resize-y rounded-md border border-emerald-600 bg-emerald-50/40 p-2 text-sm dark:bg-emerald-950/40"
          />
          {/* Fresh actions whenever the picks change: a confirmation or a
              result for a different set of changes would be misleading. */}
          <ResultActions
            key={[...picked].sort((a, b) => a - b).join(',')}
            corrected={corrected}
            target={targetFor(applied)}
            {...actions}
          />
        </div>
      )}
    </section>
  );
}
