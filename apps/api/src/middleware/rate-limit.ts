import { createMiddleware } from "hono/factory";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";

const WINDOW_SEC = 60;
const MAX_REQUESTS = 120;
const SESSION_READ_MAX_REQUESTS = 600;

export function createRateLimitMiddleware(store: IRateLimitStore) {
  return createMiddleware(async (c, next) => {
    // Session reads happen on every SSR page. Sharing the 120/min /users/*
    // bucket turns a burst into a false logout.
    if (c.req.method === "GET" && c.req.path === "/users/me") {
      await next();
      return;
    }
    const ip =
      c.req.header("cf-connecting-ip") ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `rl:${ip}:${c.req.path}`;
    const max =
      c.req.method === "GET" && c.req.path === "/users/me"
        ? SESSION_READ_MAX_REQUESTS
        : MAX_REQUESTS;
    const result = await store.increment(key, max, WINDOW_SEC);
    if (!result.allowed) {
      if (result.retryAfterSec !== undefined) {
        c.header("Retry-After", String(result.retryAfterSec));
      }
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
