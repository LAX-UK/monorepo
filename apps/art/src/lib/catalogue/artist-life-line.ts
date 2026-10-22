import type { PublicArtistDetail } from "@auction/shop-contracts";

type ArtistLifeSource = Partial<
  Pick<PublicArtistDetail, "nationality" | "birthYear" | "deathYear">
>;

/**
 * “British, 1924–2001”, “British”, “b. 1960”; null when the record has neither.
 * Mirrors `formatArtistLifeLine` in `catalogue-artist-card.vm.ts` so the exhibition page does
 * not depend on the artist card module; the two should merge into one helper.
 */
export function artistLifeLine(artist: ArtistLifeSource): string | null {
  const { birthYear = null, deathYear = null } = artist;
  const years =
    birthYear !== null && deathYear !== null
      ? `${birthYear}–${deathYear}`
      : birthYear !== null
        ? `b. ${birthYear}`
        : null;
  const parts = [artist.nationality?.trim() || null, years].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}
