import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/popup/App.tsx';
import { MAX_INPUT_CHARACTERS } from '../../src/shared/constants.ts';

function renderPopup() {
  const user = userEvent.setup();
  render(<App />);
  const textbox = screen.getByRole('textbox', { name: 'Text to improve' });
  return { user, textbox };
}

describe('popup', () => {
  // WB-UI-001
  it('renders the product name and a labelled text field', () => {
    renderPopup();
    expect(screen.getByRole('heading', { level: 1, name: 'WriteBetter' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Text to improve' })).toBeInTheDocument();
  });

  // WB-UI-002
  it('starts with zero counts and no error', () => {
    const { textbox } = renderPopup();
    expect(textbox).toHaveAccessibleDescription(/0 words · 0 \/ 5,000 characters/);
    expect(textbox).not.toBeInvalid();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // WB-UI-003
  it('updates the counts as the user types, using the singular for one word', async () => {
    const { user, textbox } = renderPopup();

    await user.type(textbox, 'Hello');
    expect(textbox).toHaveAccessibleDescription(/1 word · 5 \/ 5,000 characters/);

    await user.type(textbox, ' world');
    expect(textbox).toHaveAccessibleDescription(/2 words · 11 \/ 5,000 characters/);
  });

  // WB-UI-004
  it('warns, and marks the field invalid, when the text is over the limit', () => {
    const { textbox } = renderPopup();

    // Typing 5,001 keystrokes would be slow and adds nothing; a change event
    // is what the textarea sees when text is pasted.
    fireEvent.change(textbox, { target: { value: 'a'.repeat(MAX_INPUT_CHARACTERS + 1) } });

    expect(screen.getByRole('alert')).toHaveTextContent('This text is too long');
    expect(textbox).toBeInvalid();
  });

  // WB-UI-005
  it('removes the warning once the text is shortened', async () => {
    const { user, textbox } = renderPopup();
    fireEvent.change(textbox, { target: { value: 'a'.repeat(MAX_INPUT_CHARACTERS + 1) } });

    await user.type(textbox, '{Backspace}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(textbox).not.toBeInvalid();
  });

  // WB-UI-006
  it('can be reached with the keyboard', async () => {
    const { user, textbox } = renderPopup();
    await user.tab();
    expect(textbox).toHaveFocus();
  });

  // WB-SEC-003
  it('shows markup typed by the user as text, never as HTML', async () => {
    const { user, textbox } = renderPopup();
    await user.type(textbox, '<img src=x onerror=alert(1)>');

    expect(textbox).toHaveValue('<img src=x onerror=alert(1)>');
    expect(document.querySelector('img')).toBeNull();
  });

  // WB-UI-007
  it('says plainly that writing actions are not available yet', () => {
    renderPopup();
    expect(screen.getByText(/writing actions are not available/i)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
