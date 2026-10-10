import type { ShopIdentityMeReadResult } from "@/lib/shop-identity.server";
import { safeRelativeReturnPath } from "@auction/identity-rp";
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
  const safe = safeRelativeReturnPath(returnTo);
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
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
