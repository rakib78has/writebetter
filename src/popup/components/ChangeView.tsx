import type { Issue } from '../../writing/types.ts';

/**
 * Shows the original text with each fix marked inline: removed text struck
 * through, added text highlighted.
 *
 * Built from the exact fixes that were applied rather than by diffing the
 * two texts, so it can never show a change that didn't happen. Everything is
 * rendered as React text nodes, never HTML.
 */
export function ChangeView({ original, fixed }: { original: string; fixed: readonly Issue[] }) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;

  for (const issue of fixed) {
    const replacement = issue.replacements[0] ?? '';
    parts.push(original.slice(cursor, issue.start));
    parts.push(
      <span key={issue.start}>
        <del className="rounded-sm px-0.5 bg-red-100 text-red-900 decoration-red-600 dark:bg-red-950 dark:text-red-200">
          <span className="sr-only">removed: </span>
          {issue.original}
        </del>
        {replacement !== '' && (
          <ins className="ml-0.5 rounded-sm px-0.5 bg-emerald-100 text-emerald-900 no-underline dark:bg-emerald-950 dark:text-emerald-200">
            <span className="sr-only">added: </span>
            {replacement}
          </ins>
        )}
      </span>
    );
    cursor = issue.end;
  }
  parts.push(original.slice(cursor));

  return (
    <p
      aria-label="Changes"
      className="rounded-md border border-slate-200 p-2 text-sm whitespace-pre-wrap dark:border-slate-700"
    >
      {parts}
    </p>
  );
}
