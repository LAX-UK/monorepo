/**
 * Treats `%`, `_` and `\` in typed text as ordinary characters in a LIKE pattern.
 * PostgreSQL's default LIKE escape character is the backslash, so the escaped text
 * matches literally in every `like` / `ilike` built from it.
 */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** A pattern matching rows that contain `text` literally. */
export function containsPattern(text: string): string {
  return `%${escapeLikePattern(text)}%`;
}

/** A pattern matching rows that start with `text` literally. */
export function startsWithPattern(text: string): string {
  return `${escapeLikePattern(text)}%`;
}
