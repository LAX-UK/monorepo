/*
 * The search chip's words, shared by list pages and their server-built models. A plain module (no "use client"), so server code can call it: a value exported from
 * a client module is only a client reference on the server.
 */

/** The chip for the search in force, worded the same on every list: "Search: ada". */
export function searchChipLabel(query: string): string {
  return `Search: ${query.trim()}`;
}
