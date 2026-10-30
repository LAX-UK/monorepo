/** The catalogue search a saved search runs. */
export function savedSearchHref(query: Readonly<Record<string, string>>): string {
  const search = new URLSearchParams(query).toString();
  return search ? `/search?${search}` : "/search";
}

/**
 * What a saved search looks for, in words: the text searched, and whether filters narrow it.
 * Filter names are the catalogue's own keys, so they are never shown as they are stored.
 */
export function savedSearchSummary(query: Readonly<Record<string, string>>): string {
  const text = query.q?.trim();
  const filters = Object.keys(query).filter((key) => key !== "q" && query[key]).length;
  const filterWords = filters === 0 ? "" : filters === 1 ? "1 filter" : `${filters} filters`;
  if (text && filterWords) return `“${text}” with ${filterWords}`;
  if (text) return `“${text}”`;
  return filterWords ? `The whole catalogue, with ${filterWords}` : "The whole catalogue";
}
