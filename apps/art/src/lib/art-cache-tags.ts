/** Tag on every cached editorial read; revalidating it makes the next request refetch them all. */
export const ART_EDITORIAL_CACHE_TAG = "art:editorial";

/** Catalogue reads are tagged by resource (`art:artworks`, `art:artists`); see artCatalogueFetch. */
export const ART_ARTWORKS_CACHE_TAG = "art:artworks";
export const ART_ARTISTS_CACHE_TAG = "art:artists";

/**
 * Tags a caller of `/api/revalidate` may purge: editorial, and the artwork and artist lists that
 * staff publishing changes. The catalogue-wide `art:catalogue` tag stays out, so a leaked secret
 * cannot flush every catalogue cache (and so hammer shop-api) on demand.
 */
export const REVALIDATABLE_ART_TAGS = [
  ART_EDITORIAL_CACHE_TAG,
  ART_ARTWORKS_CACHE_TAG,
  ART_ARTISTS_CACHE_TAG,
] as const;

export type RevalidatableArtTag = (typeof REVALIDATABLE_ART_TAGS)[number];
