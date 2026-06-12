/** Returns true when the request may carry an authenticated session (cookie or Bearer). */
export function hasSessionCredential(headers: Headers): boolean {
  const cookie = headers.get("cookie");
  if (cookie) {
    const hasSessionCookie =
      /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie) ||
      /(?:^|;\s*)better-auth\.session_token=/.test(cookie);
    if (hasSessionCookie) return true;
  }
  const authorization = headers.get("authorization");
  return authorization?.startsWith("Bearer ") === true;
}
