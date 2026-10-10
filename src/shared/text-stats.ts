import { MAX_INPUT_CHARACTERS } from './constants.ts';

export interface TextStats {
  /** User-perceived characters, so an emoji like 👋🏽 counts as one. */
  characters: number;
  /** Whitespace-separated tokens containing at least one letter or digit. */
  words: number;
  /** True when `characters` exceeds the limit the extension accepts. */
  overLimit: boolean;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/**
 * Counts characters and words the way a person would.
 *
 * `string.length` counts UTF-16 code units, so it reports 4 for "👋🏽" and
 * would let emoji-heavy text silently eat into the length limit. Graphemes
 * are what the user sees.
 *
 * Words are split on whitespace rather than with Intl.Segmenter's word mode,
 * because that mode splits "e-mail", "me@example.com" and URLs into several
 * words. The trade-off: languages written without spaces, such as Chinese or
 * Japanese, count a whole run of text as one word.
 */
export function getTextStats(text: string): TextStats {
  let characters = 0;
  for (const _ of graphemes.segment(text)) characters++;

  const words = text.split(/\s+/u).filter((token) => HAS_LETTER_OR_DIGIT.test(token)).length;

  return { characters, words, overLimit: characters > MAX_INPUT_CHARACTERS };
}
