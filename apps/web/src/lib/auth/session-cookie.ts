/** Matches Better Auth session cookie names (edge + Node safe). */
const sessionCookiePattern = /better-auth|session_token/i;

/** True when the request carries a Better Auth session cookie (cheap gate before `/users/me`). */
export function hasAuthSessionCookie(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return sessionCookiePattern.test(cookieHeader);
}
