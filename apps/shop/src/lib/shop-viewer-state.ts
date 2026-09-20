import type { ShopIdentityMeReadResult } from "@/lib/shop-identity.server";
import { type AccountChromeState, mapShopMeToAccountChromeState } from "@auction/lax-ecosystem";

/** Session vocabulary shared with header account chrome. */
export type ShopViewerState = AccountChromeState;

export type ShopViewerDestinations = {
  loginHref: string;
  registerHref: string;
  accountHref: string;
  logoutHref: string;
  disabledAccountHref?: string;
};

export function toShopViewerState(
  result: ShopIdentityMeReadResult,
  destinations: ShopViewerDestinations,
): ShopViewerState {
  return mapShopMeToAccountChromeState({
    payload: result.payload,
    sessionLookupOk: result.sessionLookupOk,
    destinations,
  });
}

export function shopStorefrontLoginHref(returnTo?: string): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/login";
  }
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export type ShopViewerGateOutcome = { allowed: true } | { allowed: false; redirectTo: string };

/** Redirect paths for routes that require an authenticated Shop viewer. */
export function gateShopAuthenticatedRoute(
  viewer: ShopViewerState,
  returnTo: string,
): ShopViewerGateOutcome {
  switch (viewer.kind) {
    case "authenticated":
      return { allowed: true };
    case "guest":
      return { allowed: false, redirectTo: shopStorefrontLoginHref(returnTo) };
    case "disabled":
      return { allowed: false, redirectTo: viewer.accountHref ?? "/account/disabled" };
    case "unavailable":
      return { allowed: false, redirectTo: "" };
  }
}
