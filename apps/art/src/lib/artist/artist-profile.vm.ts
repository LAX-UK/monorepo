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

/** The profile's sections in page order (Figma artist profile `439:6125`). */
export type ArtistSectionKey = "works" | "sold" | "exhibitions" | "stories" | "press";

export const ARTIST_SECTION_IDS: Record<ArtistSectionKey, string> = {
  works: "artist-works",
  sold: "artist-sold",
  exhibitions: "artist-exhibitions",
  stories: "artist-stories",
  press: "artist-press",
};

export const ARTIST_SECTION_LABELS: Record<ArtistSectionKey, string> = {
  works: "Available works",
  sold: "Sold works",
  exhibitions: "Exhibitions",
  stories: "Films & stories",
  press: "Press",
};

const SECTION_ORDER: readonly ArtistSectionKey[] = [
  "works",
  "sold",
  "exhibitions",
  "stories",
  "press",
];

/** Anchor tabs for the sections that render, in page order; none when fewer than two. */
export function artistSectionTabs(
  sections: Partial<Record<ArtistSectionKey, boolean>>,
): ArtistSectionTab[] {
  const tabs = SECTION_ORDER.filter((key) => sections[key]).map((key) => ({
    id: ARTIST_SECTION_IDS[key],
    label: ARTIST_SECTION_LABELS[key],
  }));
  return tabs.length > 1 ? tabs : [];
}

export type ArtistWorksLayout = "grid" | "pair" | "single";

/**
 * Works recompose for their count, so a row is never mostly empty: three or more fill the works
 * grid, two sit side by side at half width, and one sits beside an invitation to ask about more.
 */
export function artistWorksLayout(count: number): ArtistWorksLayout | null {
  if (count <= 0) return null;
  if (count === 1) return "single";
  return count === 2 ? "pair" : "grid";
}

const SENTENCE_END = /^(.+?[.!?])(\s|$)/s;

/** The short biography when there is one; otherwise the biography's opening sentence. */
export function artistIntro(input: {
  shortBio?: string | null;
  bio?: string | null;
}): string | null {
  const short = input.shortBio?.trim();
  if (short) return short;
  const bio = input.bio?.trim();
  if (!bio) return null;
  return bio.match(SENTENCE_END)?.[1] ?? bio;
}
