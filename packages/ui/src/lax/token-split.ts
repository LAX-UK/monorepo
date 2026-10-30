/** Characters that finish a token while typing; pasted text is split on any whitespace too. */
export const TOKEN_SEPARATOR = /[,;\s]+/;

/** Splits typed or pasted text into tokens, dropping blanks. */
export function splitTokens(text: string): string[] {
  return text
    .split(TOKEN_SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
