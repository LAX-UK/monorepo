/** True when the request carries the opaque Bid BFF session cookie. */
export function hasAuthSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Host-)?lax-bid-session=/.test(cookieHeader);
}
