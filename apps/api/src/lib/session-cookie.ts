/** Extract opaque Better Auth session token from a `Cookie` header value. */
export function extractBetterAuthSessionToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const m =
    /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/.exec(cookieHeader) ??
    /(?:^|;\s*)better-auth\.session_token=([^;]+)/.exec(cookieHeader);
  if (!m?.[1]) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(m[1].trim());
  } catch {
    raw = m[1].trim();
  }
  // Better Auth sets the cookie via Hono `setSignedCookie`: value is `<token>.<base64-HMAC>`.
  // The DB `session.token` column stores only `<token>` (32 alphanumerics, no `.`).
  const dot = raw.lastIndexOf(".");
  if (dot > 0) {
    const sig = raw.slice(dot + 1);
    // Hono's signed-cookie verifier expects a 44-char base64 signature ending with `=`.
    if (sig.length === 44 && sig.endsWith("=")) return raw.slice(0, dot);
  }
  return raw;
}
