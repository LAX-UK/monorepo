import { fetchPublicArtists, fetchPublicArtworks } from "@/lib/shop-api.server";
import type { PublicArtistSummary, PublicArtworkSummary } from "@auction/shop-contracts";

export type HomeSectionKey = "editions" | "artists";

/** Enough to count every artist in one read; past this the hero does not give a number. */
export const HOME_ARTIST_COUNT_LIMIT = 50;
/** One edition for the first screen and two rows of four below it. */
export const HOME_NEW_EDITIONS_LIMIT = 9;

export type HomePageComposerResult = {
  /** Newest editions that can be bought now. */
  editions: PublicArtworkSummary[];
  /** Artists staff feature on the home page, or the newest artists when none are featured. */
  artists: PublicArtistSummary[];
  /** How many artists have Shop editions, or null when there are more than one read returns. */
  artistCount: number | null;
  sectionErrors: Partial<Record<HomeSectionKey, string>>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Section unavailable";
}

export async function composeHomePageData(): Promise<HomePageComposerResult> {
  const [editionsResult, featuredResult, allArtistsResult] = await Promise.allSettled([
    fetchPublicArtworks({ limit: HOME_NEW_EDITIONS_LIMIT, availability: "available" }),
    fetchPublicArtists({ limit: 4, placement: "featured_artists" }),
    fetchPublicArtists({ limit: HOME_ARTIST_COUNT_LIMIT }),
  ]);

  const sectionErrors: Partial<Record<HomeSectionKey, string>> = {};

  const editions = editionsResult.status === "fulfilled" ? editionsResult.value.items : [];
  if (editionsResult.status === "rejected") {
    sectionErrors.editions = errorMessage(editionsResult.reason);
  }

  const allArtists = allArtistsResult.status === "fulfilled" ? allArtistsResult.value : null;
  const featured = featuredResult.status === "fulfilled" ? featuredResult.value.items : [];
  const artists = featured.length > 0 ? featured : (allArtists?.items.slice(0, 4) ?? []);
  if (artists.length === 0 && allArtistsResult.status === "rejected") {
    sectionErrors.artists = errorMessage(allArtistsResult.reason);
  }

  const artistCount = allArtists && !allArtists.nextCursor ? allArtists.items.length : null;

  return { editions, artists, artistCount, sectionErrors };
}
