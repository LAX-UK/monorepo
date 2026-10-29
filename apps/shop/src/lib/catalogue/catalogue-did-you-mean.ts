/** Edits between two strings (insertions, deletions, substitutions). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Short words tolerate one slip, longer ones about one in four letters. */
function allowedEdits(length: number): number {
  return Math.max(1, Math.floor(length / 4));
}

function words(term: string): string[] {
  return term
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3);
}

/**
 * The catalogue entry a search with no results most likely meant: the artist name, technique or
 * category whose name (or a word in it) is closest to the search, within a few typing slips. Null
 * when nothing is close, or the search already is one of them.
 */
export function suggestCatalogueTerm<T extends { term: string }>(
  query: string,
  entries: readonly T[],
): T | null {
  const typed = query.trim().toLowerCase();
  if (typed.length < 3) return null;
  let best: { entry: T; distance: number } | null = null;
  for (const entry of entries) {
    for (const candidate of [entry.term.toLowerCase(), ...words(entry.term)]) {
      if (candidate === typed) return null;
      const distance = editDistance(typed, candidate);
      if (distance > allowedEdits(candidate.length)) continue;
      if (!best || distance < best.distance) best = { entry, distance };
    }
  }
  return best?.entry ?? null;
}
