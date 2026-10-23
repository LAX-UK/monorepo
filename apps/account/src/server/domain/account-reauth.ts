/**
 * The sign-in link that proves it is still the same person (a fresh sign-in, then back to
 * `returnTo`). Used when the issuer says a change needs a recent sign-in.
 */
export function buildReauthHref(returnTo: string): string {
  const params = new URLSearchParams({ returnTo, intent: "reauth" });
  return `/api/auth/login?${params.toString()}`;
}
