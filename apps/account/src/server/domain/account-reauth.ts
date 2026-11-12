import type { AccountStepUpReason } from "@auction/identity-contracts/account";

/** The query parameter of Account's own sign-in route that says why a fresh sign-in is asked for. */
export const REAUTH_REASON_QUERY = "reason";

/**
 * The sign-in link that proves it is still the same person (a fresh sign-in, then back to
 * `returnTo`). Used when the issuer says a change needs a recent sign-in. `reason` says why, from
 * a fixed list, so the "Confirm it's you" page can word it ("Before you add a way to sign in…").
 */
export function buildReauthHref(returnTo: string, reason?: AccountStepUpReason): string {
  const params = new URLSearchParams({ returnTo, intent: "reauth" });
  if (reason) params.set(REAUTH_REASON_QUERY, reason);
  return `/api/auth/login?${params.toString()}`;
}
