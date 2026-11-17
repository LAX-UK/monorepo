import { artIdentityCookieHeader, fetchArtIdentityMe } from "@/lib/art-identity.server";
import { type ArtViewerState, toArtViewerState } from "@/lib/art-viewer-state";
import { artViewerDestinations } from "@/lib/viewer/art-viewer-destinations.server";
import { cookies } from "next/headers";
import { cache } from "react";

export const loadArtViewerState = cache(async (): Promise<ArtViewerState> => {
  const cookieStore = await cookies();
  const cookieHeader = artIdentityCookieHeader(cookieStore.getAll());
  const result = await fetchArtIdentityMe(cookieHeader);
  return toArtViewerState(result, artViewerDestinations());
});
