/** Matches packages/auth AUTH_TIMINGS.oidcRefreshTokenExpiresSec (30 days). */
const OIDC_REFRESH_TOKEN_TTL_MS = 60 * 60 * 24 * 30 * 1_000;

export function refreshExpiresAtFromNow(nowMs: number): Date {
  return new Date(nowMs + OIDC_REFRESH_TOKEN_TTL_MS);
}

export function isIdTokenFresh(idToken: string, nowMs: number, skewMs = 30_000): boolean {
  try {
    const parts = idToken.split(".");
    const payloadPart = parts[1];
    if (!payloadPart) return false;
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1_000 > nowMs + skewMs;
  } catch {
    return false;
  }
}
