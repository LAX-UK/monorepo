import {
  artIdentityCookieHeader,
  artIdentityUrl,
  fetchArtIdentityMe,
} from "@/lib/art-identity.server";
import {
  type ArtViewerDestinations,
  type ArtViewerState,
  toArtViewerState,
} from "@/lib/art-viewer-state";
import { cookies } from "next/headers";
import { cache } from "react";

function artViewerDestinations(): ArtViewerDestinations {
  return {
    loginHref: artIdentityUrl("/login"),
    registerHref: "/register",
    accountHref: "/account",
    logoutHref: artIdentityUrl("/logout"),
    disabledAccountHref: "/account/disabled",
  };
}

export const loadArtViewerState = cache(async (): Promise<ArtViewerState> => {
  const cookieStore = await cookies();
  const cookieHeader = artIdentityCookieHeader(cookieStore.getAll());
  const result = await fetchArtIdentityMe(cookieHeader);
  return toArtViewerState(result, artViewerDestinations());
});
