import { fetchPortalFollowedArtists, fetchPortalSavedArtworks } from "@/lib/art-portal.server";
import { cache } from "react";

/** One BFF read per request, shared by every card on the page. */
export const loadArtSavedArtworkSlugs = cache(async (): Promise<ReadonlySet<string>> => {
  const result = await fetchPortalSavedArtworks();
  return result.status === "ok"
    ? new Set(result.data.map((item) => item.artworkSlug))
    : new Set<string>();
});

export const loadArtFollowedArtistSlugs = cache(async (): Promise<ReadonlySet<string>> => {
  const result = await fetchPortalFollowedArtists();
  return result.status === "ok"
    ? new Set(result.data.map((item) => item.artistSlug))
    : new Set<string>();
});
