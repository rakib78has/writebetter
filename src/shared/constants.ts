/**
 * Longest text, in user-perceived characters, that WriteBetter will accept.
 *
 * A bound keeps processing time predictable and stops a pasted document from
 * freezing the popup. 5,000 characters is roughly two pages of prose, which
 * covers emails, messages and form answers. Revisit it once the grammar
 * engine's performance has been measured (Milestone 3).
 */
export const MAX_INPUT_CHARACTERS = 5_000;
