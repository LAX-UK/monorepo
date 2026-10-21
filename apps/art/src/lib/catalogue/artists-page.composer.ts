import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export type ArtArtistsPageVm = {
  /** Upper-case A–Z, or null for the full newest-first directory. */
  letter: string | null;
  cards: CatalogueArtistCardVm[];
  /** Curated `featured_artists` placement; only on the unfiltered first page. */
  featured: CatalogueArtistCardVm[];
  nextPageHref: string | null;
  failed: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

/** A letter page lists up to this many artists by name; the API does not page name sorts. */
export const ARTISTS_LETTER_PAGE_LIMIT = 50;
const ARTISTS_PAGE_SIZE = 24;
const FEATURED_ARTISTS_LIMIT = 6;

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseArtistLetter(value: string | string[] | undefined): string | null {
  const letter = firstString(value)?.trim().toUpperCase();
  return letter && /^[A-Z]$/.test(letter) ? letter : null;
}

function artistsPageHref(letter: string | null, cursor: string | undefined): string {
  if (letter) return `/artists?letter=${letter.toLowerCase()}`;
  return cursor ? `/artists?cursor=${encodeURIComponent(cursor)}` : "/artists";
}

export async function composeArtistsPage(
  services: {
    catalogue: Pick<ArtCataloguePort, "listArtists">;
    viewer: ArtViewerPort;
    favorites: ArtFavoritesReadPort;
  },
  query: { cursor?: string | string[]; letter?: string | string[] },
): Promise<ArtArtistsPageVm> {
  const { catalogue } = services;
  const letter = parseArtistLetter(query.letter);
  const cursor = letter ? undefined : firstString(query.cursor);
  const showFeatured = !letter && !cursor;
  const favoritesPromise = loadViewerFavoriteContext(services, artistsPageHref(letter, cursor), {
    followedArtists: true,
  });
  const [pageResult, featuredResult] = await Promise.allSettled([
    catalogue.listArtists(
      letter
        ? { limit: ARTISTS_LETTER_PAGE_LIMIT, letter, sort: "nameAsc" }
        : { limit: ARTISTS_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
    ),
    showFeatured
      ? catalogue.listArtists({ limit: FEATURED_ARTISTS_LIMIT, placement: "featured_artists" })
      : Promise.resolve({ items: [] }),
  ]);
  const { favoriteAuth, followedArtistSlugs } = await favoritesPromise;
  const featured =
    featuredResult.status === "fulfilled"
      ? buildCatalogueArtistCards(featuredResult.value.items, followedArtistSlugs)
      : [];
  if (pageResult.status === "rejected") {
    return { letter, cards: [], featured, nextPageHref: null, failed: true, favoriteAuth };
  }
  const page = pageResult.value;
  return {
    letter,
    cards: buildCatalogueArtistCards(page.items, followedArtistSlugs),
    featured,
    nextPageHref:
      !letter && page.nextCursor ? `/artists?cursor=${encodeURIComponent(page.nextCursor)}` : null,
    failed: false,
    favoriteAuth,
  };
}
