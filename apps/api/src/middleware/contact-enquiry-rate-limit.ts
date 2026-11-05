import { createMiddleware } from "hono/factory";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { clientIpOf } from "./client-ip.js";

/** Windows for the public contact form, per client address: a burst and a day. */
const LIMITS = [
  { window: "minute", windowSec: 60, max: 5 },
  { window: "day", windowSec: 86_400, max: 30 },
] as const;

/**
 * Limits the public contact enquiry endpoint per client address. The web server forwards the
 * visitor's address, so the bucket is the visitor's, not the web server's. Like the global
 * limiter it lets requests through when the store is unavailable: a lost enquiry costs more
 * than a burst of them.
 */
export function createContactEnquiryRateLimitMiddleware(
  store: IRateLimitStore,
  /** Separate buckets keep one endpoint's traffic from using up another's allowance. */
  bucket = "contact-enquiry",
) {
  return createMiddleware(async (c, next) => {
    const ip = clientIpOf(c);
    try {
      for (const { window, windowSec, max } of LIMITS) {
        const result = await store.increment(`rl:${bucket}:${window}:${ip}`, max, windowSec);
        if (!result.allowed) {
          if (result.retryAfterSec !== undefined)
            c.header("Retry-After", String(result.retryAfterSec));
          return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
        }
      }
    } catch (err) {
      console.warn("[contact-enquiry] rate limit store unavailable; allowing request", {
        err: err instanceof Error ? err.message : String(err),
      });
    }
    await next();
  });
}
