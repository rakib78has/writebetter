/**
 * The writing engine's public vocabulary. Nothing here depends on Harper or
 * any other engine, so the UI is written against these types alone and an
 * engine can be swapped (or a remote one added) without touching it.
 */

/** 'style' is a matter of taste (offered by "Polish style"); the rest are
 *  mistakes (fixed by "Fix grammar"). */
export type IssueCategory = 'spelling' | 'grammar' | 'punctuation' | 'capitalization' | 'style';

/** A problem found in a piece of text. */
export interface Issue {
  /** Offsets into the checked text, in UTF-16 code units (JavaScript string
   *  indices), so `text.slice(start, end) === original`. */
  start: number;
  end: number;
  original: string;
  category: IssueCategory;
  /** Plain-text explanation, never HTML. */
  message: string;
  /** Candidate replacements, best first. May be empty. */
  replacements: string[];
  /** Whether "Fix grammar" may apply the first replacement on its own.
   *  False when a wrong guess could change the meaning, e.g. a spelling
   *  "fix" to a name. Such issues are shown for the user to decide. */
  autoFix: boolean;
}

/** The variety of English to check against. Spelling differs between them
 *  ("colour" and "color"), as does some vocabulary. */
export type Dialect = 'american' | 'british' | 'australian' | 'canadian' | 'indian';

export const DIALECTS: readonly Dialect[] = [
  'american',
  'british',
  'australian',
  'canadian',
  'indian',
];

export interface CheckOptions {
  dialect: Dialect;
}

export interface GrammarChecker {
  /** Starts loading the engine in the background. Safe to call repeatedly. */
  prepare(): Promise<void>;
  /** Finds problems in `text`. Rejects with a GrammarCheckError on failure. */
  check(text: string, options: CheckOptions): Promise<Issue[]>;
}

export type GrammarCheckFailure = 'unavailable' | 'timeout';

/** Thrown by a GrammarChecker. Its message never contains the user's text. */
export class GrammarCheckError extends Error {
  readonly reason: GrammarCheckFailure;

  constructor(reason: GrammarCheckFailure) {
    super(
      reason === 'timeout'
        ? 'The grammar checker took too long to respond.'
        : 'The grammar checker could not be started.'
    );
    this.name = 'GrammarCheckError';
    this.reason = reason;
  }
}
