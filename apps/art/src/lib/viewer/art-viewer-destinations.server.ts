import { artIdentityUrl } from "@/lib/art-identity.server";
import type { ArtViewerDestinations, ArtViewerState } from "@/lib/art-viewer-state";

/** Where the account chrome links to; none of it depends on the visitor. */
export function artViewerDestinations(): ArtViewerDestinations {
  return {
    loginHref: artIdentityUrl("/login"),
    registerHref: "/register",
    accountHref: "/account",
    logoutHref: artIdentityUrl("/logout"),
    disabledAccountHref: "/account/disabled",
  };
}

/**
 * The account chrome a page shared between visitors is drawn with: a guest. The browser then reads
 * the real visitor from `/api/viewer` and redraws it.
 */
export function artGuestViewerState(): ArtViewerState {
  const { loginHref, registerHref } = artViewerDestinations();
  return { kind: "guest", loginHref, registerHref };
}
