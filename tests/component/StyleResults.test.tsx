import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StyleResults } from '../../src/popup/components/StyleResults.tsx';
import type { ReplaceTarget } from '../../src/popup/components/ResultActions.tsx';
import type { StyleReport } from '../../src/writing/polish-style.ts';
import type { Issue } from '../../src/writing/types.ts';

const TEXT = 'It is a very unique design, so reply ASAP.';

function suggestion(original: string, replacement: string, message: string): Issue {
  const start = TEXT.indexOf(original);
  return {
    start,
    end: start + original.length,
    original,
    category: 'style',
    message,
    replacements: [replacement],
    autoFix: false,
  };
}

const UNIQUE = suggestion('very unique', 'unique', '`Unique` is absolute.');
const ASAP = suggestion('ASAP', 'as soon as possible', 'Try expanding this initialism.');

function renderResults(suggestions: Issue[] = [UNIQUE, ASAP]) {
  const user = userEvent.setup();
  const report: StyleReport = { original: TEXT, suggestions };
  const targetFor = vi.fn((applied: Issue[]): ReplaceTarget => ({
    kind: 'rich',
    original: TEXT,
    fixes: applied.map(({ start, end, original, replacements }) => ({
      start,
      end,
      original,
      replacement: replacements[0] ?? '',
    })),
  }));
  const replaceText = vi.fn(() => Promise.resolve({ status: 'replaced' as const }));
  render(
    <StyleResults
      report={report}
      targetFor={targetFor}
      replaceText={replaceText}
      copyText={vi.fn(() => Promise.resolve())}
    />
  );
  return { user, targetFor, replaceText };
}

describe('style suggestions', () => {
  // WB-UI-043
  it('lists suggestions as unticked choices, and changes nothing yet', () => {
    renderResults();

    expect(screen.getByRole('heading', { name: '2 style suggestions' })).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    expect(screen.getByText('`Unique` is absolute.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Corrected text' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace on page' })).not.toBeInTheDocument();
  });

  // WB-UI-044
  it('applies a ticked suggestion, and removes it when unticked', async () => {
    const { user } = renderResults();
    const asap = screen.getByRole('checkbox', { name: 'ASAP → as soon as possible' });

    await user.click(asap);
    expect(screen.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
      'It is a very unique design, so reply as soon as possible.'
    );
    expect(screen.getByLabelText('Changes')).toHaveTextContent('removed: ASAP');

    await user.click(asap);
    expect(screen.queryByRole('textbox', { name: 'Corrected text' })).not.toBeInTheDocument();
  });

  // WB-UI-045
  it('replaces on the page with exactly the picked changes', async () => {
    const { user, replaceText } = renderResults();
    await user.click(screen.getByRole('checkbox', { name: 'very unique → unique' }));

    await user.click(screen.getByRole('button', { name: 'Replace on page' }));
    const confirm = screen.getByRole('group', { name: 'Confirm replacement' });
    await user.click(within(confirm).getByRole('button', { name: 'Yes, replace' }));

    expect(replaceText).toHaveBeenCalledWith({
      kind: 'rich',
      expected: TEXT,
      fixes: [{ start: 8, end: 19, original: 'very unique', replacement: 'unique' }],
    });
  });

  // WB-UI-046
  it('resets the replace step when the picks change', async () => {
    const { user } = renderResults();
    await user.click(screen.getByRole('checkbox', { name: 'very unique → unique' }));
    await user.click(screen.getByRole('button', { name: 'Replace on page' }));
    expect(screen.getByRole('group', { name: 'Confirm replacement' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'ASAP → as soon as possible' }));

    expect(screen.queryByRole('group', { name: 'Confirm replacement' })).not.toBeInTheDocument();
  });

  // WB-UI-047
  it('says so honestly when there is nothing to suggest', () => {
    renderResults([]);
    expect(screen.getByText(/No style suggestions/)).toHaveTextContent(
      'Style checks are rule-based and catch only some patterns'
    );
  });
});
