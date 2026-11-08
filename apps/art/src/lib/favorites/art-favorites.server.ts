import { artCommerceRequest } from "@/lib/art-commerce-request.server";
import { fetchPortalFollowedArtists, fetchPortalSavedArtworks } from "@/lib/art-portal.server";
import {
  FOLLOW_EMAILS_PATH,
  type FollowEmailsState,
  readFollowEmailsOn,
  readFollowEmailsStopped,
} from "@/lib/favorites/follow-emails";
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

/** One read per request. */
export const loadArtFollowEmailsState = cache(async (): Promise<FollowEmailsState> => {
  try {
    const response = await artCommerceRequest(FOLLOW_EMAILS_PATH, {
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { on: null, stopped: false };
    const body = await response.json().catch(() => null);
    return { on: readFollowEmailsOn(body), stopped: readFollowEmailsStopped(body) };
  } catch {
    return { on: null, stopped: false };
  }
});
