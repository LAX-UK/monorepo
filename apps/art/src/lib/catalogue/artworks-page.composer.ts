import {
  ARTWORK_OBJECT_TYPE_OPTIONS,
  type ArtworkFilterOption,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueSearchParams,
  type ArtworkCatalogueUrlState,
  artworkCatalogueFetchQuery,
  artworkCatalogueHasActiveFilters,
  artworkCatalogueHref,
  artworkCataloguePageTitle,
  artworkCataloguePagerHref,
  artworkMediumLanding,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import {
  type ArtworkObjectTypeTileVm,
  buildArtworkObjectTypeTiles,
} from "@/lib/catalogue/artwork-object-type-tiles.vm";
import {
  type CatalogueArtworkCardVm,
  buildCatalogueArtworkCards,
} from "@/lib/catalogue/catalogue-artwork-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import { loadViewerFavoriteContext } from "@/lib/favorites/viewer-favorites";
import type { ArtCataloguePort, ArtFavoritesReadPort, ArtViewerPort } from "@/lib/ports";
import type { PublicArtworkObjectTypeFacet } from "@auction/shop-contracts";

export const ARTWORKS_PAGE_SIZE = 24;

export type FilterOption = { slug: string; label: string };

/** Image hero for the medium landings (Figma 587:9412). */
export type ArtworksLandingHeroVm = {
  title: string;
  description: string;
  imageUrl: string;
};

export type ArtworksPageVm = {
  state: ArtworkCatalogueUrlState;
  title: string;
  /** Set on a medium landing whose medium has a cover image; otherwise the plain page title shows. */
  landingHero: ArtworksLandingHeroVm | null;
  hasActiveFilters: boolean;
  cards: CatalogueArtworkCardVm[];
  resultCount: number;
  categories: FilterOption[];
  artists: FilterOption[];
  /** Media with works on lax.art; every medium when the facet read fails. */
  mediumOptions: ArtworkFilterOption[];
  objectTypeTiles: ArtworkObjectTypeTileVm[];
  nextPageHref: string | null;
  failed: boolean;
  favoriteAuth: ArtFavoriteAuth;
};

export type ArtworksPageMetadataVm = {
  title: string;
  description?: string;
  canonical: string;
};

export function composeArtworksPageMetadata(
  searchParams: ArtworkCatalogueSearchParams,
): ArtworksPageMetadataVm {
  const state = parseArtworkCatalogueParams(searchParams);
  const landing = artworkMediumLanding(state.objectTypes);
  if (landing) {
    return {
      title: landing.metaTitle,
      description: landing.metaDescription,
      canonical: landing.path,
    };
  }
  return { title: `${artworkCataloguePageTitle(state)} | LAX Art`, canonical: "/artworks" };
}

export async function composeArtworksPage(
  services: { catalogue: ArtCataloguePort; viewer: ArtViewerPort; favorites: ArtFavoritesReadPort },
  searchParams: ArtworkCatalogueSearchParams,
): Promise<ArtworksPageVm> {
  const state = parseArtworkCatalogueParams(searchParams);
  const favoritesPromise = loadViewerFavoriteContext(services, artworkCatalogueHref(state));
  const [artworks, categories, artists, objectTypes] = await Promise.allSettled([
    services.catalogue.listArtworks({
      limit: ARTWORKS_PAGE_SIZE,
      ...artworkCatalogueFetchQuery(state),
    }),
    services.catalogue.listCategories({ limit: 50 }),
    services.catalogue.listArtists({ limit: 50 }),
    services.catalogue.listArtworkObjectTypes(),
  ]);
  const favorites = await favoritesPromise;
  const list = artworks.status === "fulfilled" ? artworks.value : null;
  const facets = objectTypes.status === "fulfilled" ? objectTypes.value.items : [];
  const landing = artworkMediumLanding(state.objectTypes);
  const landingCover = landing
    ? facets.find((facet) => facet.objectType === landing.objectType)?.coverImageUrl
    : null;

  return {
    state,
    title: artworkCataloguePageTitle(state),
    landingHero:
      landing && landingCover
        ? { title: landing.title, description: landing.metaDescription, imageUrl: landingCover }
        : null,
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
    mediumOptions: buildMediumOptions(facets),
    // Figma's medium landings carry a hero instead of the tile rail.
    objectTypeTiles: landing ? [] : buildArtworkObjectTypeTiles(facets, state),
    nextPageHref: list?.nextCursor
      ? artworkCataloguePagerHref(state, { cursor: list.nextCursor, back: state.cursor ?? null })
      : null,
    failed: list === null,
    favoriteAuth: favorites.favoriteAuth,
  };
}

function buildMediumOptions(
  facets: readonly PublicArtworkObjectTypeFacet[],
): ArtworkFilterOption[] {
  if (facets.length === 0) return [...ARTWORK_OBJECT_TYPE_OPTIONS];
  return ARTWORK_OBJECT_TYPE_OPTIONS.filter((option) =>
    facets.some((facet) => facet.objectType === option.value),
  );
}
