import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChangeView } from '../../src/popup/components/ChangeView.tsx';
import type { Issue } from '../../src/writing/types.ts';

function fix(text: string, original: string, replacement: string): Issue {
  const start = text.indexOf(original);
  return {
    start,
    end: start + original.length,
    original,
    category: 'grammar',
    message: '',
    replacements: [replacement],
    autoFix: true,
  };
}

describe('ChangeView', () => {
  // WB-UI-029
  it('marks each removed and added piece inline, around unchanged text', () => {
    const text = 'I has a apple.';
    render(
      <ChangeView original={text} fixed={[fix(text, 'has', 'have'), fix(text, 'a ', 'an ')]} />
    );
    const view = screen.getByLabelText('Changes');

    expect([...view.querySelectorAll('del')].map((d) => d.textContent)).toEqual([
      'removed: has',
      'removed: a ',
    ]);
    expect([...view.querySelectorAll('ins')].map((i) => i.textContent)).toEqual([
      'added: have',
      'added: an ',
    ]);
    expect(view.textContent).toBe('I removed: hasadded: have removed: a added: an apple.');
  });

  // WB-UI-030
  it('shows a removal without an empty insertion', () => {
    const text = 'and and done';
    render(<ChangeView original={text} fixed={[fix(text, 'and ', '')]} />);
    const view = screen.getByLabelText('Changes');

    expect(view.querySelectorAll('del')).toHaveLength(1);
    expect(view.querySelectorAll('ins')).toHaveLength(0);
  });

  // WB-SEC-022
  it('renders markup in the text as text', () => {
    const text = '<img src=x onerror=alert(1)> teh';
    render(<ChangeView original={text} fixed={[fix(text, 'teh', 'the')]} />);
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByLabelText('Changes')).toHaveTextContent('<img src=x onerror=alert(1)>');
  });
});
