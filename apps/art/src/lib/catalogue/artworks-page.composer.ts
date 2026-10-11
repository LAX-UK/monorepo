import {
  type ArtworkCatalogueSearchParams,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFetchQuery,
  artworkCatalogueHasActiveFilters,
  artworkCatalogueHref,
  artworkCataloguePageTitle,
  artworkCataloguePagerHref,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";

export const ARTWORKS_PAGE_SIZE = 24;

export type FilterOption = { slug: string; label: string };

export type ArtworksPageVm = {
  state: ArtworkCatalogueUrlState;
  title: string;
  hasActiveFilters: boolean;
  cards: CatalogueArtworkCardVm[];
  resultCount: number;
  categories: FilterOption[];
  artists: FilterOption[];
  nextPageHref: string | null;
  failed: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

export function composeArtworksPageTitle(searchParams: ArtworkCatalogueSearchParams): string {
  return artworkCataloguePageTitle(parseArtworkCatalogueParams(searchParams));
}

export async function composeArtworksPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  searchParams: ArtworkCatalogueSearchParams,
): Promise<ArtworksPageVm> {
  const state = parseArtworkCatalogueParams(searchParams);
  const favoritesPromise = loadViewerFavoriteContext(services, artworkCatalogueHref(state));
  const [artworks, categories, artists] = await Promise.allSettled([
    services.catalogue.listArtworks({
      limit: ARTWORKS_PAGE_SIZE,
      ...artworkCatalogueFetchQuery(state),
    }),
    services.catalogue.listCategories({ limit: 50 }),
    services.catalogue.listArtists({ limit: 50 }),
  ]);
  const favorites = await favoritesPromise;
  const list = artworks.status === "fulfilled" ? artworks.value : null;

  return {
    state,
    title: artworkCataloguePageTitle(state),
    hasActiveFilters: artworkCatalogueHasActiveFilters(state),
    cards: list ? buildCatalogueArtworkCards(list.items, favorites.savedArtworkSlugs) : [],
    resultCount: list ? (list.totalCount ?? list.items.length) : 0,
    categories:
      categories.status === "fulfilled"
        ? categories.value.items.map((item) => ({ slug: item.slug, label: item.label }))
        : [],
    artists:
      artists.status === "fulfilled"
        ? artists.value.items.map((item) => ({ slug: item.slug, label: item.name }))
        : [],
    nextPageHref: list?.nextCursor
      ? artworkCataloguePagerHref(state, { cursor: list.nextCursor, back: state.cursor ?? null })
      : null,
    failed: list === null,
    favoriteAuth: favorites.favoriteAuth,
  };
}
