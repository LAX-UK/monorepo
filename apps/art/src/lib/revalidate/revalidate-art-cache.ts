import { ART_PAGE_CACHE_TAG_PATHS, type RevalidatableArtTag } from "@/lib/art-cache-tags";
import { revalidatePath, revalidateTag } from "next/cache";

export type ArtCacheRevalidator = {
  revalidateTag(tag: string): void;
  revalidatePath(path: string, type: "page"): void;
};

const nextCache: ArtCacheRevalidator = { revalidateTag, revalidatePath };

/**
 * The one place lax.art drops cached content after a write: each data tag, and for a page tag the
 * prerendered page itself, which Next renders again on its next request. The page is named by its
 * route (`type: "page"`), which holds however the request reached it (middleware rewrites `/`).
 */
export function revalidateArtCache(
  tags: readonly RevalidatableArtTag[],
  cache: ArtCacheRevalidator = nextCache,
): void {
  for (const tag of tags) {
    cache.revalidateTag(tag);
    const path = ART_PAGE_CACHE_TAG_PATHS[tag];
    if (path) cache.revalidatePath(path, "page");
  }
}
