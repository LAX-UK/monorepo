/** True when the request carries a Better Auth session cookie (cheap gate before `/users/me`). */
export function hasAuthSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookieHeader);
}
