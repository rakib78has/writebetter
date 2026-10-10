import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResultActions, type ReplaceTarget } from '../../src/popup/components/ResultActions.tsx';
import type { ReplaceOutcome } from '../../src/popup/page-access.ts';

const FIELD: ReplaceTarget = { kind: 'field', start: 11, end: 18, original: 'teh end' };
const CORRECTED = 'the end';

function setup(
  target: ReplaceTarget = FIELD,
  outcomes: ReplaceOutcome[] = [{ status: 'replaced' }],
  copyText = vi.fn(() => Promise.resolve())
) {
  const user = userEvent.setup();
  const replaceText = vi.fn((): Promise<ReplaceOutcome> =>
    Promise.resolve(outcomes.shift() ?? { status: 'replaced' })
  );
  render(
    <ResultActions
      corrected={CORRECTED}
      target={target}
      replaceText={replaceText}
      copyText={copyText}
    />
  );
  return { user, replaceText, copyText };
}

describe('result actions: copy', () => {
  // WB-UI-022
  it('copies the corrected text and says so', async () => {
    const { user, copyText } = setup();
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(copyText).toHaveBeenCalledWith(CORRECTED);
    expect(await screen.findByText('Copied to the clipboard.')).toBeInTheDocument();
  });

  // WB-UI-023
  it('explains how to copy by hand when the clipboard is unavailable', async () => {
    const { user } = setup(
      FIELD,
      [],
      vi.fn(() => Promise.reject(new Error('denied')))
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByText(/Couldn’t copy/)).toBeInTheDocument();
  });
});

describe('result actions: replace on page', () => {
  // WB-SEC-021
  it('never changes the page without a second, explicit confirmation', async () => {
    const { user, replaceText } = setup();

    await user.click(screen.getByRole('button', { name: 'Replace on page' }));

    expect(replaceText).not.toHaveBeenCalled();
    expect(screen.getByRole('group', { name: 'Confirm replacement' })).toBeInTheDocument();
  });

  // WB-UI-024
  it('moves focus to the confirmation, and replaces when confirmed', async () => {
    const { user, replaceText } = setup();
    await user.click(screen.getByRole('button', { name: 'Replace on page' }));

    expect(screen.getByRole('button', { name: 'Yes, replace' })).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(replaceText).toHaveBeenCalledWith({
      start: 11,
      end: 18,
      expected: 'teh end',
      replacement: CORRECTED,
    });
    expect(await screen.findByText('Replaced on the page.')).toBeInTheDocument();
  });

  // WB-UI-025
  it.each([
    [
      'the Cancel button',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
      },
    ],
    [
      'the Escape key',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard('{Escape}');
      },
    ],
  ])('can be cancelled with %s', async (_label, cancel) => {
    const { user, replaceText } = setup();
    await user.click(screen.getByRole('button', { name: 'Replace on page' }));

    await cancel(user);

    expect(replaceText).not.toHaveBeenCalled();
    expect(screen.queryByRole('group', { name: 'Confirm replacement' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace on page' })).toBeInTheDocument();
  });

  // WB-UI-026
  it('undoes a replacement by putting the original back', async () => {
    const { user, replaceText } = setup(FIELD, [{ status: 'replaced' }, { status: 'replaced' }]);
    await user.click(screen.getByRole('button', { name: 'Replace on page' }));
    await user.click(screen.getByRole('button', { name: 'Yes, replace' }));

    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(replaceText).toHaveBeenLastCalledWith({
      start: 11,
      end: 11 + CORRECTED.length,
      expected: CORRECTED,
      replacement: 'teh end',
    });
    expect(await screen.findByText('The original text is back on the page.')).toBeInTheDocument();
    // Replacing again is offered, since the page holds the original again.
    expect(screen.getByRole('button', { name: 'Replace on page' })).toBeInTheDocument();
  });

  // WB-UI-027
  it.each<[ReplaceOutcome['status'], RegExp]>([
    ['changed', /has changed since WriteBetter read it/],
    ['field-gone', /no longer selected/],
    ['read-only', /can’t be edited/],
    ['too-long', /longer than that text box allows/],
    ['failed', /didn’t accept the change/],
    ['page-unavailable', /can no longer reach that page/],
  ])('explains a "%s" result and does not offer to try again blindly', async (status, message) => {
    const { user } = setup(FIELD, [{ status }]);
    await user.click(screen.getByRole('button', { name: 'Replace on page' }));
    await user.click(screen.getByRole('button', { name: 'Yes, replace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('button', { name: 'Replace on page' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  // WB-UI-028
  it.each<[string, ReplaceTarget, RegExp]>([
    [
      'typed text',
      { kind: 'unavailable', reason: 'typed' },
      /select it there and open WriteBetter/,
    ],
    ['a read-only field', { kind: 'unavailable', reason: 'read-only' }, /read-only/],
  ])('offers only Copy for %s, and says why', (_label, target, message) => {
    setup(target);
    expect(screen.queryByRole('button', { name: 'Replace on page' })).not.toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
