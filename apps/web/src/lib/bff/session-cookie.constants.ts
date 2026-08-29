/** Shared Bid BFF cookie identifiers — safe for middleware (no Node crypto/redis deps). */
export const BID_SESSION_COOKIE_NAMES = ["lax-bid-session", "__Host-lax-bid-session"] as const;

export function bidSessionCookieUsesSecureTransport(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" && env.ALLOW_HTTP_COOKIES !== "true";
}

export function getBidSessionCookieName(env: NodeJS.ProcessEnv = process.env): string {
  return bidSessionCookieUsesSecureTransport(env) ? "__Host-lax-bid-session" : "lax-bid-session";
}
