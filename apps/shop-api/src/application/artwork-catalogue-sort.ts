export const ARTWORK_CATALOGUE_SORTS = ["newest", "titleAsc", "priceAsc", "priceDesc"] as const;

export type ArtworkCatalogueSort = (typeof ARTWORK_CATALOGUE_SORTS)[number];

export const DEFAULT_ARTWORK_CATALOGUE_SORT: ArtworkCatalogueSort = "newest";

export function parseArtworkCatalogueSort(value: string | undefined): ArtworkCatalogueSort | null {
  if (!value) return null;
  return ARTWORK_CATALOGUE_SORTS.find((sort) => sort === value) ?? null;
}
