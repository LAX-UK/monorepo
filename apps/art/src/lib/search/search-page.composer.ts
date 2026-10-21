import {
  type CatalogueArtistCardVm,
  buildCatalogueArtistCards,
} from "@/lib/catalogue/catalogue-artist-card.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export const SEARCH_QUERY_MAX_LENGTH = 120;

export type SearchPageStatus = "idle" | "results" | "no_results" | "unavailable";

export type SearchPageVm = {
  query: string;
  status: SearchPageStatus;
  artworks: CatalogueArtworkCardVm[];
  artists: CatalogueArtistCardVm[];
  /** Full filterable results on /artworks; null when there is no query. */
  allArtworksHref: string | null;
  favoriteAuth: ArtFavoriteAuth;
};

export function parseSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, SEARCH_QUERY_MAX_LENGTH);
}

export function searchPageHref(query: string): string {
  return query ? `/search?q=${encodeURIComponent(query)}` : "/search";
}

export async function composeSearchPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  searchParams: Record<string, string | string[] | undefined>,
): Promise<SearchPageVm> {
  const query = parseSearchQuery(searchParams.q);
  const favoritesPromise = loadViewerFavoriteContext(services, searchPageHref(query), {
    savedArtworks: true,
    followedArtists: Boolean(query),
  });
  if (!query) {
    const favorites = await favoritesPromise;
    return {
      query,
      status: "idle",
      artworks: [],
      artists: [],
      allArtworksHref: null,
      favoriteAuth: favorites.favoriteAuth,
    };
  }

  const [artworks, artists] = await Promise.allSettled([
    services.catalogue.listArtworks({ q: query, limit: 12 }),
    services.catalogue.listArtists({ q: query, limit: 6 }),
  ]);
  const favorites = await favoritesPromise;
  const artworkCards =
    artworks.status === "fulfilled"
      ? buildCatalogueArtworkCards(artworks.value.items, favorites.savedArtworkSlugs)
      : [];
  const artistCards =
    artists.status === "fulfilled"
      ? buildCatalogueArtistCards(artists.value.items, favorites.followedArtistSlugs)
      : [];

  let status: SearchPageStatus = "results";
  if (artworks.status === "rejected" && artists.status === "rejected") status = "unavailable";
  else if (artworkCards.length === 0 && artistCards.length === 0) status = "no_results";

  return {
    query,
    status,
    artworks: artworkCards,
    artists: artistCards,
    allArtworksHref: `/artworks?q=${encodeURIComponent(query)}`,
    favoriteAuth: favorites.favoriteAuth,
  };
}
