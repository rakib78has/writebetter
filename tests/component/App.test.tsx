import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/popup/App.tsx';
import type { SelectionOutcome } from '../../src/popup/page-access.ts';
import { MAX_INPUT_CHARACTERS } from '../../src/shared/constants.ts';
import { GrammarCheckError, type GrammarChecker, type Issue } from '../../src/writing/types.ts';

const NO_FIELD: SelectionOutcome = { status: 'no-field' };

const captured = (text: string, readOnly = false): SelectionOutcome => ({
  status: 'captured',
  text,
  field: 'textarea',
  selection: { start: 0, end: text.length },
  readOnly,
});

/** A promise the test settles by hand, to observe in-between states. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Builds an issue for `original` at its first position in `text`. */
function issueIn(text: string, original: string, replacement: string, autoFix = true): Issue {
  const start = text.indexOf(original);
  return {
    start,
    end: start + original.length,
    original,
    category: 'spelling',
    message: `Did you mean “${replacement}”?`,
    replacements: [replacement],
    autoFix,
  };
}

/** Stand-ins for writing to the page and the clipboard. */
function pageFakes() {
  return {
    replaceText: vi.fn(() => Promise.resolve({ status: 'replaced' as const })),
    copyText: vi.fn(() => Promise.resolve()),
  };
}

/** A grammar checker that answers every check with `respond(text)`. */
function fakeGrammar(respond: (text: string) => Promise<Issue[]> = () => Promise.resolve([])) {
  return {
    prepare: vi.fn(() => Promise.resolve()),
    check: vi.fn(respond),
  } satisfies GrammarChecker;
}

async function renderPopup(
  outcome: SelectionOutcome = NO_FIELD,
  grammar: GrammarChecker = fakeGrammar()
) {
  const user = userEvent.setup();
  render(<App {...pageFakes()} loadSelection={() => Promise.resolve(outcome)} grammar={grammar} />);
  const textbox = screen.getByRole('textbox', { name: 'Text to improve' });
  // Let the selection load settle so each test starts from a stable state.
  await screen.findByText(
    /select text in a text box|loaded the text|no text is selected|can’t read|never reads|isn’t supported|went wrong/i
  );
  const fixButton = screen.getByRole('button', { name: 'Fix grammar' });
  return { user, textbox, fixButton };
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
  it('says that checking is local, English-only and fallible', async () => {
    await renderPopup();
    expect(screen.getByText(/runs on your device and supports English only/)).toBeInTheDocument();
    expect(screen.getByText(/can miss problems/)).toBeInTheDocument();
  });
});

describe('popup loading the page selection', () => {
  // WB-UI-008
  it('announces that it is reading the selection, then fills the field with it', async () => {
    const loader = deferred<SelectionOutcome>();
    render(<App {...pageFakes()} loadSelection={() => loader.promise} grammar={fakeGrammar()} />);

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
    const loader = deferred<SelectionOutcome>();
    render(<App {...pageFakes()} loadSelection={() => loader.promise} grammar={fakeGrammar()} />);
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
    render(<App {...pageFakes()} loadSelection={load} grammar={fakeGrammar()} />);
    await screen.findByText(/select text in a text box/i);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('popup Fix grammar', () => {
  const TEXT = 'This is teh plan, Rakib.';

  // WB-UI-013
  it('is unavailable until there is text to check, and again when it is too long', async () => {
    const { user, textbox, fixButton } = await renderPopup();
    expect(fixButton).toBeDisabled();

    await user.type(textbox, '   ');
    expect(fixButton).toBeDisabled();

    await user.type(textbox, 'Hi');
    expect(fixButton).toBeEnabled();

    fireEvent.change(textbox, { target: { value: 'a'.repeat(MAX_INPUT_CHARACTERS + 1) } });
    expect(fixButton).toBeDisabled();
  });

  // WB-UI-014
  it('shows progress, then the corrected text and what was fixed', async () => {
    const result = deferred<Issue[]>();
    const grammar = fakeGrammar(() => result.promise);
    const { user, fixButton } = await renderPopup(captured(TEXT), grammar);

    await user.click(fixButton);
    expect(fixButton).toBeDisabled();
    expect(fixButton).toHaveTextContent('Checking…');
    expect(grammar.check).toHaveBeenCalledWith(TEXT);

    await act(async () => {
      result.resolve([issueIn(TEXT, 'teh', 'the')]);
      await Promise.resolve();
    });

    expect(screen.getByRole('textbox', { name: 'Corrected text' })).toHaveValue(
      'This is the plan, Rakib.'
    );
    expect(screen.getByRole('heading', { name: 'Fixed 1 problem' })).toBeInTheDocument();
    expect(screen.getByText('Did you mean “the”?')).toBeInTheDocument();
    expect(fixButton).toHaveTextContent('Fix grammar');
  });

  // WB-UI-015
  it('keeps the original text untouched in its own field', async () => {
    const grammar = fakeGrammar(() => Promise.resolve([issueIn(TEXT, 'teh', 'the')]));
    const { user, textbox, fixButton } = await renderPopup(captured(TEXT), grammar);

    await user.click(fixButton);
    await screen.findByRole('textbox', { name: 'Corrected text' });

    expect(textbox).toHaveValue(TEXT);
  });

  // WB-UI-016
  it('lists problems left for the user without showing a corrected text', async () => {
    const grammar = fakeGrammar(() => Promise.resolve([issueIn(TEXT, 'Rakib', 'Rabbi', false)]));
    const { user, fixButton } = await renderPopup(captured(TEXT), grammar);

    await user.click(fixButton);

    expect(
      await screen.findByRole('heading', { name: '1 possible problem to check yourself' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Corrected text' })).not.toBeInTheDocument();
  });

  // WB-UI-017
  it('says so when there is nothing to fix', async () => {
    const { user, fixButton } = await renderPopup(captured('All good here.'));
    await user.click(fixButton);
    expect(await screen.findByText('No problems found.')).toBeInTheDocument();
  });

  // WB-UI-018
  it('clears results as soon as the text is edited, so they are never stale', async () => {
    const grammar = fakeGrammar(() => Promise.resolve([issueIn(TEXT, 'teh', 'the')]));
    const { user, textbox, fixButton } = await renderPopup(captured(TEXT), grammar);
    await user.click(fixButton);
    await screen.findByRole('textbox', { name: 'Corrected text' });

    await user.type(textbox, '!');

    expect(screen.queryByRole('textbox', { name: 'Corrected text' })).not.toBeInTheDocument();
  });

  // WB-UI-019
  it('drops a result that arrives after the text was edited', async () => {
    const result = deferred<Issue[]>();
    const { user, textbox, fixButton } = await renderPopup(
      captured(TEXT),
      fakeGrammar(() => result.promise)
    );
    await user.click(fixButton);
    await user.type(textbox, '!');

    await act(async () => {
      result.resolve([issueIn(TEXT, 'teh', 'the')]);
      await Promise.resolve();
    });

    expect(screen.queryByRole('textbox', { name: 'Corrected text' })).not.toBeInTheDocument();
    expect(screen.queryByText('Fixed 1 problem')).not.toBeInTheDocument();
  });

  // WB-UI-020
  it.each<[string, GrammarCheckError, RegExp]>([
    ['cannot start', new GrammarCheckError('unavailable'), /couldn’t start/],
    ['times out', new GrammarCheckError('timeout'), /took too long/],
  ])('explains when the checker %s, and lets the user retry', async (_label, error, message) => {
    const grammar = fakeGrammar(() => Promise.reject(error));
    const { user, textbox, fixButton } = await renderPopup(captured(TEXT), grammar);

    await user.click(fixButton);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(textbox).toHaveValue(TEXT);
    expect(fixButton).toBeEnabled();
  });

  // WB-UI-021
  it('can be run from the keyboard', async () => {
    const grammar = fakeGrammar();
    const { user, fixButton } = await renderPopup(captured(TEXT), grammar);

    fixButton.focus();
    await user.keyboard('{Enter}');

    expect(grammar.check).toHaveBeenCalledOnce();
  });

  // WB-SEC-017
  it('renders markup in an issue message as text', async () => {
    const issue = { ...issueIn(TEXT, 'teh', 'the'), message: '<img src=x onerror=alert(1)>' };
    const { user, fixButton } = await renderPopup(
      captured(TEXT),
      fakeGrammar(() => Promise.resolve([issue]))
    );
    await user.click(fixButton);

    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('popup writing back to the page', () => {
  const TEXT = 'This is teh plan.';
  const withFix = () => fakeGrammar(() => Promise.resolve([issueIn(TEXT, 'teh', 'the')]));

  // WB-UI-031
  it('offers to replace text that came from an editable field on the page', async () => {
    const { user, fixButton } = await renderPopup(captured(TEXT), withFix());
    await user.click(fixButton);
    expect(await screen.findByRole('button', { name: 'Replace on page' })).toBeInTheDocument();
    expect(screen.getByLabelText('Changes')).toHaveTextContent('teh');
  });

  // WB-UI-032
  it.each<[string, SelectionOutcome]>([
    ['text typed into the popup', NO_FIELD],
    ['a read-only field', captured(TEXT, true)],
  ])('offers only Copy for %s', async (_label, outcome) => {
    const { user, textbox, fixButton } = await renderPopup(outcome, withFix());
    if (outcome.status !== 'captured') await user.type(textbox, TEXT);
    await user.click(fixButton);

    expect(await screen.findByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace on page' })).not.toBeInTheDocument();
  });

  // WB-UI-033
  it('starts each new result with fresh actions', async () => {
    const { user, textbox, fixButton } = await renderPopup(captured(TEXT), withFix());
    await user.click(fixButton);
    await user.click(await screen.findByRole('button', { name: 'Replace on page' }));
    expect(screen.getByRole('group', { name: 'Confirm replacement' })).toBeInTheDocument();

    // Editing clears the result; checking again must not reopen the old
    // confirmation.
    await user.type(textbox, ' ');
    await user.click(fixButton);
    await screen.findByRole('button', { name: 'Replace on page' });

    expect(screen.queryByRole('group', { name: 'Confirm replacement' })).not.toBeInTheDocument();
  });
});
