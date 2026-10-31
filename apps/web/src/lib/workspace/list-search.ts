/**
 * The one search rule of the workspace lists: a record matches when every word of the query is
 * in one of its fields, ignoring case and accents. An empty query matches everything.
 */
export function matchesEveryWord(
  fields: readonly (string | null | undefined)[],
  query: string,
): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fold(fields.filter(Boolean).join(" "));
  return words.every((word) => text.includes(word));
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** The first value of a search parameter, trimmed; `null` when it is missing or blank. */
export function searchParam(raw: string | readonly string[] | null | undefined): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw) as string | null | undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
