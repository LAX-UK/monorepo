import type { ArtistProfile } from "@/lib/data/contracts";

const A_Z = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function isLatinLetter(c: string): boolean {
  return /^[A-Z]$/i.test(c);
}

/** First significant Latin letter of the display name, or null if none. */
export function nameSortLetter(name: string): string | null {
  const t = name.trim();
  for (const ch of t) {
    if (isLatinLetter(ch)) {
      return ch.toUpperCase();
    }
  }
  return null;
}

export function filterArtistsByLetter(
  artists: readonly ArtistProfile[],
  letter: string,
): ArtistProfile[] {
  if (letter === "ALL") {
    return [...artists];
  }
  const L = letter.toUpperCase();
  return artists.filter((a) => nameSortLetter(a.name) === L);
}

export function filterArtistsByQuery(
  artists: readonly ArtistProfile[],
  query: string,
): ArtistProfile[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [...artists];
  }
  return artists.filter(
    (a) => a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q),
  );
}

export function filterArtistsDirectory(
  artists: readonly ArtistProfile[],
  letter: string,
  query: string,
): ArtistProfile[] {
  return filterArtistsByLetter(filterArtistsByQuery(artists, query), letter);
}

/** Set of A–Z that appear as the first letter of at least one artist name. */
export function lettersPresent(artists: readonly ArtistProfile[]): Set<string> {
  const set = new Set<string>();
  for (const a of artists) {
    const L = nameSortLetter(a.name);
    if (L) {
      set.add(L);
    }
  }
  return set;
}

export const ALPHABET_LETTERS: readonly string[] = A_Z.split("");
