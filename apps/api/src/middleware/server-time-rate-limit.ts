import { createMiddleware } from "hono/factory";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { clientIpOf } from "./client-ip.js";

/** A page needs three calls to measure the clock and one every ten minutes after that. */
const REQUESTS_PER_MINUTE = 30;
const WINDOW_SEC = 60;

/**
 * Lightly limits the public server-time endpoint per client address. It lets requests through
 * when the counter is unavailable: the answer is cheap, and a visitor must not lose their
 * countdown because a counter is down.
 */
export function createServerTimeRateLimitMiddleware(
  store: IRateLimitStore,
  maxPerMinute: number = REQUESTS_PER_MINUTE,
) {
  return createMiddleware(async (c, next) => {
    try {
      const result = await store.increment(
        `rl:server-time:${clientIpOf(c)}`,
        maxPerMinute,
        WINDOW_SEC,
      );
      if (!result.allowed) {
        if (result.retryAfterSec !== undefined)
          c.header("Retry-After", String(result.retryAfterSec));
        c.header("Cache-Control", "no-store");
        return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
      }
    } catch (err) {
      console.warn("[server-time] rate limit store unavailable; allowing request", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    await next();
  });
}
