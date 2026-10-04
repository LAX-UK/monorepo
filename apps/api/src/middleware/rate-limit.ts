import { readForwardedClientIp } from "@auction/auth";
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
    const ip = readForwardedClientIp((name) => c.req.header(name)) ?? "unknown";
    const key = `rl:${ip}:${c.req.path}`;
    const max =
      c.req.method === "GET" && c.req.path === "/users/me"
        ? SESSION_READ_MAX_REQUESTS
        : MAX_REQUESTS;
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
