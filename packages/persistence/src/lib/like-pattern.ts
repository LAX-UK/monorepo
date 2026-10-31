/** Treats `%`, `_` and `\` in typed text as ordinary characters in a LIKE pattern. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
