import { type ArtViewerState, artStorefrontLoginHref } from "@/lib/art-viewer-state";

/** What a favorite control needs to know about the viewer. */
export type ArtFavoriteAuth = {
  signedIn: boolean;
  /** Sign-in route that returns to the page the control lives on. */
  loginHref: string;
};

export function buildArtFavoriteAuth(viewer: ArtViewerState, returnTo: string): ArtFavoriteAuth {
  return {
    signedIn: viewer.kind === "authenticated",
    loginHref: artStorefrontLoginHref(returnTo),
  };
}
