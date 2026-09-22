import type { ShopViewerState } from "@/lib/shop-viewer-state";

export type ShopFooterAccountState =
  | { kind: "guest" }
  | { kind: "authenticated" }
  | { kind: "disabled"; accountHref: string }
  | { kind: "unavailable" };

export function toShopFooterAccountState(viewer: ShopViewerState): ShopFooterAccountState {
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
