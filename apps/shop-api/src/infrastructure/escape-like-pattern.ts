/** Makes staff-typed text match literally inside a LIKE pattern, where `%` and `_` are wildcards. */
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}
