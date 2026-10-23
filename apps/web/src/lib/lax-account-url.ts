/**
 * Where LAX Account lives, from one setting: `NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN`.
 *
 * LAX Account owns name, email, password, two-step verification, sessions and addresses for every
 * LAX product, so Bid links straight to it instead of hosting its own copies. The setting is
 * public (it appears in links) and is read at build time, so `next.config.ts`, server code and
 * client components all agree on one value. Plain data with no imports so `next.config.ts` can
 * load it.
 *
 * When the setting is empty:
 * - in local development and tests, links go to the Account dev server (`localhost:3040`), so
 *   the "LAX Account" entries work without any setup;
 * - in a production build they go to the live portal, `https://account.lax.bid`, the same
 *   default the sign-in service uses. A test environment must set the variable to its own
 *   Account origin at build time.
 *
 * The entry is therefore always present: there is no unconfigured state to hide it, and no
 * redirect that depends on a runtime switch, which is what once sent people between Bid and
 * Account in a loop. Account never links back to a Bid page that redirects to Account.
 */
export const LOCAL_LAX_ACCOUNT_ORIGIN = "http://localhost:3040";
export const DEFAULT_LAX_ACCOUNT_ORIGIN = "https://account.lax.bid";

export function resolveLaxAccountOrigin(
  configured: string | undefined,
  nodeEnv: string | undefined,
): string {
  const origin = configured?.trim().replace(/\/+$/, "");
  if (origin) return origin;
  return nodeEnv === "production" ? DEFAULT_LAX_ACCOUNT_ORIGIN : LOCAL_LAX_ACCOUNT_ORIGIN;
}

/** The LAX Account origin for this build, without a trailing slash. */
export function laxAccountOrigin(): string {
  // Written out in full so Next can inline both values into client bundles.
  return resolveLaxAccountOrigin(process.env.NEXT_PUBLIC_LAX_ACCOUNT_ORIGIN, process.env.NODE_ENV);
}

/** An absolute LAX Account URL for a path such as `/account/security`. */
export function laxAccountUrl(path = "/account"): string {
  return `${laxAccountOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Account's front door, opened from Bid so it can offer a way back. */
export function laxAccountHomeUrl(): string {
  return laxAccountUrl("/account?from=bid");
}
