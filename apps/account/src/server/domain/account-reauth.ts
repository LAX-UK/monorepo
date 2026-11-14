import type { AccountStepUpReason } from "@auction/identity-contracts/account";

/** The query parameter of Account's own sign-in route that says why a fresh sign-in is asked for. */
export const REAUTH_REASON_QUERY = "reason";

/**
 * Marks a fresh sign-in made in the small "Confirm it's you" window. The sign-in route then ends
 * on {@link STEP_UP_COMPLETE_PATH} whatever `returnTo` says, so the flag can never send anyone
 * anywhere else.
 */
export const REAUTH_DISPLAY_QUERY = "display";
export const REAUTH_DISPLAY_POPUP = "popup";

/** Where the window lands once the issuer has confirmed the person: it tells the page and closes. */
export const STEP_UP_COMPLETE_PATH = "/api/auth/step-up-complete";

/**
 * The sign-in link that proves it is still the same person (a fresh sign-in, then back to
 * `returnTo`). Used when the issuer says a change needs a recent sign-in. `reason` says why, from
 * a fixed list, so the "Confirm it's you" page can word it ("Before you add a way to sign in…").
 * With `popup`, the sign-in runs in a small window that reports back to the page instead.
 */
export function buildReauthHref(
  returnTo: string,
  reason?: AccountStepUpReason,
  options: { popup?: boolean } = {},
): string {
  const params = new URLSearchParams({ returnTo, intent: "reauth" });
  if (reason) params.set(REAUTH_REASON_QUERY, reason);
  if (options.popup) params.set(REAUTH_DISPLAY_QUERY, REAUTH_DISPLAY_POPUP);
  return `/api/auth/login?${params.toString()}`;
}
