import type { ArtViewerState } from "@/lib/art-viewer-state";

export type ArtFooterAccountState =
  | { kind: "guest" }
  | { kind: "authenticated" }
  | { kind: "disabled"; accountHref: string }
  | { kind: "unavailable" };

export function toArtFooterAccountState(viewer: ArtViewerState): ArtFooterAccountState {
  switch (viewer.kind) {
    case "guest":
      return { kind: "guest" };
    case "authenticated":
      return { kind: "authenticated" };
    case "disabled":
      return {
        kind: "disabled",
        accountHref: viewer.accountHref ?? "/account/disabled",
      };
    case "unavailable":
      return { kind: "unavailable" };
  }
}

/**
 * The Account column's links for a visitor. When the sign-in status could not be read the visitor
 * is offered sign-in, as a guest is.
 */
export function artFooterAccountLinks(
  state: ArtFooterAccountState,
): Array<{ label: string; href: string }> {
  switch (state.kind) {
    case "authenticated":
      return [
        { label: "Your account", href: "/account" },
        { label: "Favourites", href: "/account/favourites" },
      ];
    case "disabled":
      return [{ label: "Account status", href: state.accountHref }];
    case "guest":
    case "unavailable":
      return [
        { label: "Sign in", href: "/login" },
        { label: "Create account", href: "/register" },
      ];
  }
}
