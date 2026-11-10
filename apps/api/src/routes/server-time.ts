import { Hono } from "hono";
import { createServerTimeRateLimitMiddleware } from "../middleware/server-time-rate-limit.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";

/** The server's clock, which is the one that decides when a lot closes. */
export type ServerClock = { now(): number };

/**
 * A public "what time is it": the server's time in milliseconds, never cached, so pages can
 * measure how far their clock is from the one that accepts or rejects a bid. It names no one
 * and reads nothing from the database.
 */
export function createServerTimeRoutes(deps: {
  rateLimitStore: IRateLimitStore;
  clock?: ServerClock;
}) {
  const clock = deps.clock ?? { now: () => Date.now() };
  const r = new Hono();

  r.get("/", createServerTimeRateLimitMiddleware(deps.rateLimitStore), (c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ serverNowMs: clock.now() });
  });

  return r;
}
