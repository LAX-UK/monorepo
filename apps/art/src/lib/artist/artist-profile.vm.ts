export type ArtistLifeInput = {
  nationality?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
};

/**
 * "French, 1869–1954", "French, b. 1969", "1869–1954" or "French"; null when nothing is known.
 * A death year alone is not shown: without a birth year it reads as a mistake.
 */
export function formatArtistLifeLine({
  nationality,
  birthYear,
  deathYear,
}: ArtistLifeInput): string | null {
  const place = nationality?.trim() || null;
  let years: string | null = null;
  if (birthYear != null)
    years = deathYear != null ? `${birthYear}–${deathYear}` : `b. ${birthYear}`;
  const parts = [place, years].filter((part): part is string => part != null);
  return parts.length > 0 ? parts.join(", ") : null;
}

export type ArtistSectionTab = { id: string; label: string };

export const ARTIST_SECTION_IDS = {
  works: "artist-works",
  originals: "artist-originals",
  exhibitions: "artist-exhibitions",
  stories: "artist-stories",
} as const;

/** Anchor tabs for the sections that render, in page order; none when fewer than two. */
export function artistSectionTabs(sections: {
  works: boolean;
  originals: boolean;
  exhibitions: boolean;
  stories: boolean;
}): ArtistSectionTab[] {
  const candidates: (ArtistSectionTab | null)[] = [
    sections.works ? { id: ARTIST_SECTION_IDS.works, label: "Featured works" } : null,
    sections.originals ? { id: ARTIST_SECTION_IDS.originals, label: "Originals" } : null,
    sections.exhibitions ? { id: ARTIST_SECTION_IDS.exhibitions, label: "Exhibitions" } : null,
    sections.stories ? { id: ARTIST_SECTION_IDS.stories, label: "Films & stories" } : null,
  ];
  const tabs = candidates.filter((tab): tab is ArtistSectionTab => tab != null);
  return tabs.length > 1 ? tabs : [];
}
