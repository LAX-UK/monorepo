/** "b. 1961" for a living artist, "1920–1999" for one who has died; `null` without a birth year. */
export function artistLifespan(birthYear: string | null, deathYear: string | null): string | null {
  if (!birthYear) return null;
  return deathYear ? `${birthYear}–${deathYear}` : `b. ${birthYear}`;
}
