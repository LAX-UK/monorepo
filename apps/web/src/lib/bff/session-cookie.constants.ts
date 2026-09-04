/** Shared Bid BFF cookie identifiers — safe for middleware (no Node crypto/redis deps). */
export const BID_SESSION_COOKIE_NAMES = ["lax-bid-session", "__Host-lax-bid-session"] as const;

/** base64url encoding of 32 random bytes — must match {@link generateSessionId}. */
export const BID_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isBidSessionId(value: string | null | undefined): value is string {
  return typeof value === "string" && BID_SESSION_ID_PATTERN.test(value);
}

export function parseBidSessionId(value: string | null | undefined): string | null {
  return isBidSessionId(value) ? value : null;
}

export function bidSessionCookieUsesSecureTransport(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.ALLOW_HTTP_COOKIES !== "true";
}

export function getBidSessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return bidSessionCookieUsesSecureTransport(env) ? "__Host-lax-bid-session" : "lax-bid-session";
}
