import type { UnsupportedReason } from '../shared/capture.ts';
import type { SelectionOutcome } from './page-access.ts';

export interface SelectionMessage {
  tone: 'neutral' | 'success' | 'warning';
  text: string;
}

const UNSUPPORTED: Record<UnsupportedReason, string> = {
  contenteditable: 'This kind of editor isn’t supported yet.',
  frame: 'Text boxes inside embedded frames aren’t supported yet.',
  'input-type': 'This kind of field isn’t supported.',
};

/** Explains to the user what happened when the popup read their selection. */
export function describeSelection(outcome: SelectionOutcome | 'loading'): SelectionMessage {
  if (outcome === 'loading') return { tone: 'neutral', text: 'Reading your selection…' };

  switch (outcome.status) {
    case 'captured':
      return {
        tone: 'success',
        text: outcome.readOnly
          ? 'Loaded the text you selected. That field is read-only, so it can’t be changed.'
          : 'Loaded the text you selected.',
      };
    case 'empty-selection':
      return {
        tone: 'neutral',
        text: 'No text is selected. Select text in the field and open WriteBetter again, or type below.',
      };
    case 'no-field':
      return {
        tone: 'neutral',
        text: 'Select text in a text box on the page to load it here, or type below.',
      };
    case 'sensitive-field':
      return {
        tone: 'warning',
        text: 'WriteBetter never reads password, verification-code or payment fields.',
      };
    case 'unsupported-field':
      return {
        tone: 'warning',
        text: `${UNSUPPORTED[outcome.reason]} Copy your text and paste it below instead.`,
      };
    case 'page-unavailable':
      return {
        tone: 'neutral',
        text: 'WriteBetter can’t read this page. Browser pages and the Chrome Web Store are off-limits to extensions. You can still type or paste text below.',
      };
    case 'failed':
      return {
        tone: 'warning',
        text: 'Something went wrong reading your selection. You can still paste the text below.',
      };
  }
}
