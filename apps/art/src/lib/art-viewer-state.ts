import type { ArtIdentityMeReadResult } from "@/lib/art-identity.server";
import { safeRelativeReturnPath } from "@auction/identity-rp/safe-return-path";
import { type AccountChromeState, mapShopMeToAccountChromeState } from "@auction/lax-ecosystem";

export type ArtViewerState = AccountChromeState;

export type ArtViewerDestinations = {
  loginHref: string;
  registerHref: string;
  accountHref: string;
  logoutHref: string;
  disabledAccountHref?: string;
};

export function toArtViewerState(
  result: ArtIdentityMeReadResult,
  destinations: ArtViewerDestinations,
): ArtViewerState {
  return mapShopMeToAccountChromeState({
    payload: result.payload,
    sessionLookupOk: result.sessionLookupOk,
    destinations,
  });
}

export function artStorefrontLoginHref(returnTo?: string): string {
  const safe = safeRelativeReturnPath(returnTo);
  return safe ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login";
}

export type ArtViewerGateOutcome = { allowed: true } | { allowed: false; redirectTo: string };

export function gateArtAuthenticatedRoute(
  viewer: ArtViewerState,
  returnTo: string,
): ArtViewerGateOutcome {
  switch (viewer.kind) {
    case "authenticated":
      return { allowed: true };
    case "guest":
      return { allowed: false, redirectTo: artStorefrontLoginHref(returnTo) };
    case "disabled":
      return { allowed: false, redirectTo: viewer.accountHref ?? "/account/disabled" };
    case "unavailable":
      return { allowed: false, redirectTo: "" };
  }
}
