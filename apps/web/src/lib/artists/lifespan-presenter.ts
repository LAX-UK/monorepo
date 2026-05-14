/** Single place for catalogue lifespan copy (SRP). */
export function formatArtistLifespan(input: {
  birthYear: string | null | undefined;
  deathYear: string | null | undefined;
}): string {
  const b = input.birthYear?.trim();
  const d = input.deathYear?.trim();
  if (b && d) return `${b} – ${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return "—";
}
