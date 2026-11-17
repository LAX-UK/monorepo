import { ART_PRERENDERED_ROUTES } from "@/lib/routing/prerendered-routes";

/** Tag on every cached editorial read; revalidating it makes the next request refetch them all. */
export const ART_EDITORIAL_CACHE_TAG = "art:editorial";

/** Catalogue reads are tagged by resource (`art:artworks`, `art:artists`); see artCatalogueFetch. */
export const ART_ARTWORKS_CACHE_TAG = "art:artworks";
export const ART_ARTISTS_CACHE_TAG = "art:artists";

/** The prerendered home page; shop-api sends it with every editorial and catalogue write. */
export const ART_HOME_CACHE_TAG = "art:home";

/**
 * Tags a caller of `/api/revalidate` may purge: editorial, the artwork and artist lists that
 * staff publishing changes, and the home page. The catalogue-wide `art:catalogue` tag stays out,
 * so a leaked secret cannot flush every catalogue cache (and so hammer shop-api) on demand.
 */
export const REVALIDATABLE_ART_TAGS = [
  ART_EDITORIAL_CACHE_TAG,
  ART_ARTWORKS_CACHE_TAG,
  ART_ARTISTS_CACHE_TAG,
  ART_HOME_CACHE_TAG,
] as const;

export type RevalidatableArtTag = (typeof REVALIDATABLE_ART_TAGS)[number];

/**
 * Tags that name a prerendered page rather than the data reads it is made of. Next keeps a page's
 * HTML under the route it was rendered for: the prerendered copy middleware serves `/` from.
 */
export const ART_PAGE_CACHE_TAG_PATHS: Partial<Record<RevalidatableArtTag, string>> = {
  [ART_HOME_CACHE_TAG]: ART_PRERENDERED_ROUTES["/"],
};
