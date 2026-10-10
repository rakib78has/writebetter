import { useId } from 'react';
import type { GrammarReport } from '../../writing/fix-grammar.ts';
import type { Issue } from '../../writing/types.ts';

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function IssueItem({ issue, showFix }: { issue: Issue; showFix: boolean }) {
  const [replacement] = issue.replacements;
  return (
    <li className="flex flex-col gap-0.5">
      <span>
        <span className="font-medium line-through decoration-red-500">{issue.original}</span>
        {showFix && replacement !== undefined && (
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

/** Shows the outcome of "Fix grammar": the corrected text and what changed. */
export function GrammarResults({ report }: { report: GrammarReport }) {
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
          <label htmlFor={correctedId} className="text-sm font-medium">
            Corrected text
          </label>
          <textarea
            id={correctedId}
            value={report.corrected}
            readOnly
            rows={5}
            className="resize-y rounded-md border border-emerald-600 bg-emerald-50/40 p-2 text-sm dark:bg-emerald-950/40"
          />
          <h2 className="font-medium">Fixed {plural(fixed.length, 'problem', 'problems')}</h2>
          <ul className="flex flex-col gap-1.5">
            {fixed.map((issue) => (
              <IssueItem key={`${issue.start}-${issue.end}`} issue={issue} showFix />
            ))}
          </ul>
        </div>
      )}
      {toReview.length > 0 && (
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">
            {plural(toReview.length, 'possible problem', 'possible problems')} to check yourself
          </h2>
          <ul className="flex flex-col gap-1.5">
            {toReview.map((issue) => (
              <IssueItem key={`${issue.start}-${issue.end}`} issue={issue} showFix />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
