/** Tag on every cached editorial read; revalidating it makes the next request refetch them all. */
export const ART_EDITORIAL_CACHE_TAG = "art:editorial";

/**
 * Tags a caller of `/api/revalidate` may purge. Kept explicit so a leaked secret cannot be
 * used to flush catalogue caches (and so hammer shop-api) on demand.
 */
export const REVALIDATABLE_ART_TAGS = [ART_EDITORIAL_CACHE_TAG] as const;

export type RevalidatableArtTag = (typeof REVALIDATABLE_ART_TAGS)[number];
