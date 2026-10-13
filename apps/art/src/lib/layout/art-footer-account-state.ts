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
