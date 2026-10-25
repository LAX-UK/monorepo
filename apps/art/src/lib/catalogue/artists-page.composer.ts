import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";
import {
  type MarketingArtistDirectoryQuery,
  marketingArtistDirectoryHref,
  parseMarketingArtistDirectoryQuery,
} from "@auction/marketing-ui";

export type ArtArtistsPageVm = {
  query: MarketingArtistDirectoryQuery;
  cards: CatalogueArtistCardVm[];
  /** Artists matching the filters across all pages; null when the API does not say. */
  total: number | null;
  nextCursor: string | null;
  failed: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

const ARTISTS_PAGE_SIZE = 24;

/** Upper-case A–Z from a `letter` query value, or null. */
export function parseArtistLetter(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const letter = raw?.trim().toUpperCase();
  return letter && /^[A-Z]$/.test(letter) ? letter : null;
}

/**
 * The lax.art artist directory: search, A–Z, featured and sort as query links, A–Z by name
 * unless "Recently added" is chosen, 24 artists a page.
 */
export async function composeArtistsPage(
  services: {
    catalogue: Pick<ArtCataloguePort, "listArtists">;
    viewer: ArtViewerPort;
    favorites: ArtFavoritesReadPort;
  },
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ArtArtistsPageVm> {
  const query = parseMarketingArtistDirectoryQuery(searchParams);
  const favoritesPromise = loadViewerFavoriteContext(
    services,
    marketingArtistDirectoryHref("/artists", query, query.cursor ? { cursor: query.cursor } : {}),
    { followedArtists: true },
  );
  const pagePromise = services.catalogue.listArtists({
    limit: ARTISTS_PAGE_SIZE,
    ...(query.show === "featured" ? { placement: "featured_artists" as const } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.letter ? { letter: query.letter.toUpperCase() } : {}),
    sort: query.sort === "recent" ? "newest" : "nameAsc",
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });
  const [pageResult, { favoriteAuth, followedArtistSlugs }] = await Promise.all([
    pagePromise.then(
      (page) => ({ ok: true as const, page }),
      () => ({ ok: false as const }),
    ),
    favoritesPromise,
  ]);
  if (!pageResult.ok) {
    return { query, cards: [], total: null, nextCursor: null, failed: true, favoriteAuth };
  }
  const { page } = pageResult;
  return {
    query,
    cards: buildCatalogueArtistCards(page.items, followedArtistSlugs),
    total: page.total ?? null,
    nextCursor: page.nextCursor ?? null,
    failed: false,
    favoriteAuth,
  };
}
