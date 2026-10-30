import type { ShopIdentityMeReadResult } from "@/lib/shop-identity.server";
import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";
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

/** An email the shopper already gave, so sign-in or sign-up opens with it filled in. */
export type ShopAuthHrefOptions = { loginHint?: string | null };

function shopAuthHref(path: string, returnTo: string | undefined, options: ShopAuthHrefOptions) {
  const query = new URLSearchParams();
  const safe = safeRelativeReturnPath(returnTo);
  if (safe) query.set("returnTo", safe);
  const hint = options.loginHint?.trim();
  if (hint) query.set("loginHint", hint);
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

export function shopStorefrontLoginHref(returnTo?: string, options: ShopAuthHrefOptions = {}) {
  return shopAuthHref("/login", returnTo, options);
}

export function shopStorefrontRegisterHref(returnTo?: string, options: ShopAuthHrefOptions = {}) {
  return shopAuthHref("/register", returnTo, options);
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
