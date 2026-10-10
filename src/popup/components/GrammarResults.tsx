import { useId } from 'react';
import type { GrammarReport } from '../../writing/fix-grammar.ts';
import type { Issue } from '../../writing/types.ts';
import { ChangeView } from './ChangeView.tsx';
import { ResultActions, type ResultActionsProps } from './ResultActions.tsx';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function IssueItem({ issue }: { issue: Issue }) {
  const [replacement] = issue.replacements;
  return (
    <li className="flex flex-col gap-0.5">
      <span>
        <span className="font-medium line-through decoration-red-500">{issue.original}</span>
        {replacement !== undefined && (
          <>
            {' → '}
            <span className="font-medium">{replacement === '' ? '(removed)' : replacement}</span>
          </>
        )}
      </span>
      <span className="text-slate-600 dark:text-slate-400">{issue.message}</span>
    </li>
  );
}

export type GrammarResultsProps = { report: GrammarReport } & Omit<ResultActionsProps, 'corrected'>;

/**
 * Shows the outcome of "Fix grammar": the changes inline, the corrected
 * text, ways to use it, and anything left for the user to decide.
 */
export function GrammarResults({ report, ...actions }: GrammarResultsProps) {
  const correctedId = useId();
  const { fixed, toReview } = report;

  if (fixed.length === 0 && toReview.length === 0) {
    return (
      <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        No problems found.
      </p>
    );
  }

  return (
    <section aria-label="Grammar results" className="flex flex-col gap-2 text-xs">
      {fixed.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-medium">
            Fixed {plural(fixed.length, 'problem', 'problems')}
          </h2>
          <ChangeView original={report.original} fixed={fixed} />
          <label htmlFor={correctedId} className="mt-1 text-sm font-medium">
            Corrected text
          </label>
          <textarea
            id={correctedId}
            value={report.corrected}
            readOnly
            rows={4}
            className="resize-y rounded-md border border-emerald-600 bg-emerald-50/40 p-2 text-sm dark:bg-emerald-950/40"
          />
          <ResultActions corrected={report.corrected} {...actions} />
          <details className="mt-1">
            <summary className="cursor-pointer text-slate-700 dark:text-slate-300">
              Why each change was made
            </summary>
            <ul className="mt-1 flex flex-col gap-1.5">
              {fixed.map((issue) => (
                <IssueItem key={`${issue.start}-${issue.end}`} issue={issue} />
              ))}
            </ul>
          </details>
        </div>
      )}
      {toReview.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">
            {plural(toReview.length, 'possible problem', 'possible problems')} to check yourself
          </h2>
          <ul className="flex flex-col gap-1.5">
            {toReview.map((issue) => (
              <IssueItem key={`${issue.start}-${issue.end}`} issue={issue} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
