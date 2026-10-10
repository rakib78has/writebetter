import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/popup/App.tsx';
import type { SelectionOutcome } from '../../src/popup/selection-source.ts';
import { MAX_INPUT_CHARACTERS } from '../../src/shared/constants.ts';

const NO_FIELD: SelectionOutcome = { status: 'no-field' };

const captured = (text: string, readOnly = false): SelectionOutcome => ({
  status: 'captured',
  text,
  field: 'textarea',
  selection: { start: 0, end: text.length },
  readOnly,
});

/** A loader the test resolves by hand, to observe the loading state. */
function deferredLoader() {
  let resolve!: (outcome: SelectionOutcome) => void;
  const promise = new Promise<SelectionOutcome>((r) => {
    resolve = r;
  });
  return { load: () => promise, resolve };
}

async function renderPopup(outcome: SelectionOutcome = NO_FIELD) {
  const user = userEvent.setup();
  render(<App loadSelection={() => Promise.resolve(outcome)} />);
  const textbox = screen.getByRole('textbox', { name: 'Text to improve' });
  // Let the selection load settle so each test starts from a stable state.
  await screen.findByText(
    /select text in a text box|loaded the text|no text is selected|can’t read|never reads|isn’t supported|went wrong/i
  );
  return { user, textbox };
}

describe('popup', () => {
  // WB-UI-001
  it('renders the product name and a labelled text field', async () => {
    await renderPopup();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteBetter' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text to improve' })).toBeInTheDocument();
  });

  // WB-UI-002
  it('starts with zero counts and no error when nothing was selected', async () => {
    const { textbox } = await renderPopup();
    expect(textbox).toHaveAccessibleDescription(/0 words · 0 \/ 5,000 characters/);
    expect(textbox).not.toBeInvalid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // WB-UI-003
  it('updates the counts as the user types, using the singular for one word', async () => {
    const { user, textbox } = await renderPopup();

    await user.type(textbox, 'Hello');
    expect(textbox).toHaveAccessibleDescription(/1 word · 5 \/ 5,000 characters/);

    await user.type(textbox, ' world');
    expect(textbox).toHaveAccessibleDescription(/2 words · 11 \/ 5,000 characters/);
  });

  // WB-UI-004
  it('warns, and marks the field invalid, when the text is over the limit', async () => {
    const { textbox } = await renderPopup();

    // Typing 5,001 keystrokes would be slow and adds nothing; a change event
    // is what the textarea sees when text is pasted.
    fireEvent.change(textbox, { target: { value: 'a'.repeat(MAX_INPUT_CHARACTERS + 1) } });

    expect(screen.getByRole('alert')).toHaveTextContent('This text is too long');
    expect(textbox).toBeInvalid();
  });

  // WB-UI-005
  it('removes the warning once the text is shortened', async () => {
    const { user, textbox } = await renderPopup();
    fireEvent.change(textbox, { target: { value: 'a'.repeat(MAX_INPUT_CHARACTERS + 1) } });

    await user.type(textbox, '{Backspace}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(textbox).not.toBeInvalid();
  });

  // WB-UI-006
  it('can be reached with the keyboard', async () => {
    const { user, textbox } = await renderPopup();
    await user.tab();
    expect(textbox).toHaveFocus();
  });

  // WB-SEC-003
  it('shows markup typed by the user as text, never as HTML', async () => {
    const { user, textbox } = await renderPopup();
    await user.type(textbox, '<img src=x onerror=alert(1)>');

    expect(textbox).toHaveValue('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  // WB-UI-007
  it('says plainly that writing actions are not available yet', async () => {
    await renderPopup();
    expect(screen.getByText(/writing actions are not available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('popup loading the page selection', () => {
  // WB-UI-008
  it('announces that it is reading the selection, then fills the field with it', async () => {
    const loader = deferredLoader();
    render(<App loadSelection={loader.load} />);

    expect(screen.getByRole('status')).toHaveTextContent('Reading your selection…');

    await act(async () => {
      loader.resolve(captured('Their going to the park.'));
      await Promise.resolve();
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loaded the text you selected.');
    expect(screen.getByRole('textbox', { name: 'Text to improve' })).toHaveValue(
      'Their going to the park.'
    );
  });

  // WB-UI-009
  it('never overwrites text the user typed while the selection was loading', async () => {
    const user = userEvent.setup();
    const loader = deferredLoader();
    render(<App loadSelection={loader.load} />);
    const textbox = screen.getByRole('textbox', { name: 'Text to improve' });

    await user.type(textbox, 'my own words');
    await act(async () => {
      loader.resolve(captured('selected text'));
      await Promise.resolve();
    });

    expect(textbox).toHaveValue('my own words');
  });

  // WB-UI-010
  it('mentions when the selected field is read-only', async () => {
    await renderPopup(captured('Fixed', true));
    expect(screen.getByRole('status')).toHaveTextContent(/read-only/);
  });

  // WB-UI-011
  it.each<[string, SelectionOutcome, RegExp]>([
    ['nothing selected', { status: 'empty-selection' }, /no text is selected/i],
    ['a password field', { status: 'sensitive-field' }, /never reads password/i],
    ['a restricted page', { status: 'page-unavailable' }, /can’t read this page/i],
    ['a rich-text editor', { status: 'unsupported-field', reason: 'contenteditable' }, /paste/i],
  ])('explains %s and leaves the field empty for typing', async (_label, outcome, message) => {
    const { textbox } = await renderPopup(outcome);
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(textbox).toHaveValue('');
  });

  // WB-UI-012
  it('reads the selection once per opening', async () => {
    const load = vi.fn(() => Promise.resolve(NO_FIELD));
    render(<App loadSelection={load} />);
    await screen.findByText(/select text in a text box/i);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
