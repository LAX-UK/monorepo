/** Extract opaque Better Auth session token from a `Cookie` header value. */
export function extractBetterAuthSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m =
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/.exec(cookieHeader) ??
    /(?:^|;\s*)better-auth\.session_token=([^;]+)/.exec(cookieHeader);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1].trim());
  } catch {
    return m[1].trim();
  }
}
