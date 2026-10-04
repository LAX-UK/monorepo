import type { Context, Next } from "hono";
import { commerceClientIp } from "./commerce-client-ip.js";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const MAX_BUCKETS = 10_000;
const SWEEP_EVERY_N_REQUESTS = 256;

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();
let requestsSinceSweep = 0;

function sweepExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStart >= WINDOW_MS) {
      buckets.delete(key);
    }
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey === undefined) break;
    buckets.delete(oldestKey);
  }
}

/** Lightweight in-process rate limit for commerce BFF routes. */
export async function commerceRateLimitMiddleware(
  c: Context,
  next: Next,
): Promise<Response | undefined> {
  const key = commerceClientIp(c);
  const now = Date.now();
  requestsSinceSweep += 1;
  if (requestsSinceSweep >= SWEEP_EVERY_N_REQUESTS) {
    requestsSinceSweep = 0;
    sweepExpiredBuckets(now);
  }
  const bucket = buckets.get(key) ?? { count: 0, windowStart: now };
  if (now - bucket.windowStart >= WINDOW_MS) {
    bucket.count = 0;
    bucket.windowStart = now;
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  if (bucket.count > MAX_REQUESTS) {
    return c.json({ error: "rate_limited" }, 429);
  }
  await next();
}
