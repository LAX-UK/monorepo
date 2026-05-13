import { createMiddleware } from "hono/factory";

/** Prevent shared caches from storing auth responses (tokens, PII in errors). */
export function createAuthNoStoreMiddleware() {
  return createMiddleware(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
    c.header("Pragma", "no-cache");
  });
}
