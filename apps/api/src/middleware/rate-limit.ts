import { createHash } from "node:crypto";
import { readForwardedClientIp } from "@auction/auth";
import { createMiddleware } from "hono/factory";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";

const WINDOW_SEC = 60;
const MAX_REQUESTS = 120;

/**
 * Reads every signed-in page makes. They must never be what turns ordinary browsing into a 429,
 * and they reach the API from the web server, whose address every visitor shares, so a per-IP
 * bucket would be shared by everyone.
 * - `skip`: not counted at all (the session read: a burst there would look like a logout).
 * - a number: counted per session (the bearer token), with that budget per window.
 */
const SESSION_READS: Readonly<Record<string, "skip" | number>> = {
  "/users/me": "skip",
  "/legal-entities/me": 600,
};

/** A short, stable key for the caller's session; never the token itself. */
function sessionKey(authorization: string | undefined): string | null {
  if (!authorization) return null;
  return createHash("sha256").update(authorization).digest("base64url").slice(0, 32);
}

export function createRateLimitMiddleware(store: IRateLimitStore) {
  return createMiddleware(async (c, next) => {
    const sessionRead = c.req.method === "GET" ? SESSION_READS[c.req.path] : undefined;
    if (sessionRead === "skip") {
      await next();
      return;
    }
    const ip = readForwardedClientIp((name) => c.req.header(name)) ?? "unknown";
    const session = sessionRead === undefined ? null : sessionKey(c.req.header("authorization"));
    const key = session ? `rl:session:${session}:${c.req.path}` : `rl:${ip}:${c.req.path}`;
    const max = session && sessionRead !== undefined ? sessionRead : MAX_REQUESTS;
    let result: Awaited<ReturnType<IRateLimitStore["increment"]>>;
    try {
      result = await store.increment(key, max, WINDOW_SEC);
    } catch (err) {
      console.warn("[rate-limit] redis unavailable; allowing request", {
        path: c.req.path,
        err: err instanceof Error ? err.message : String(err),
      });
      await next();
      return;
    }
    if (!result.allowed) {
      if (result.retryAfterSec !== undefined) {
        c.header("Retry-After", String(result.retryAfterSec));
      }
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
