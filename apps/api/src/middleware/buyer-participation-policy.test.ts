import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createBidUserRateLimitMiddleware } from "./buyer-participation-policy.js";

function mount(store: IRateLimitStore) {
  const app = new Hono<{ Variables: { userId?: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
    await next();
  });
  app.use("*", createBidUserRateLimitMiddleware({} as never, store));
  app.post("/bids", (c) => c.json({ ok: true }));
  return app;
}

describe("createBidUserRateLimitMiddleware", () => {
  it("allows bids inside both windows", async () => {
    const increment = vi.fn().mockResolvedValue({ allowed: true, remaining: 10 });
    const res = await mount({ increment }).request("/bids", { method: "POST" });
    expect(res.status).toBe(200);
    expect(increment).toHaveBeenCalledTimes(2);
  });

  it("returns 429 when the minute window is exhausted", async () => {
    const increment = vi.fn().mockResolvedValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 12,
    });
    const res = await mount({ increment }).request("/bids", { method: "POST" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(await res.json()).toMatchObject({ code: "bid_rate_limited_minute" });
  });

  it("returns 429 when the hour window is exhausted", async () => {
    const increment = vi
      .fn()
      .mockResolvedValueOnce({ allowed: true, remaining: 20 })
      .mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSec: 120 });
    const res = await mount({ increment }).request("/bids", { method: "POST" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    expect(await res.json()).toMatchObject({ code: "bid_rate_limited_hour" });
  });

  it("fails closed with 503 when Redis is unavailable", async () => {
    const increment = vi.fn().mockRejectedValue(new Error("redis down"));
    const res = await mount({ increment }).request("/bids", { method: "POST" });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ code: "bid_rate_limit_unavailable" });
  });
});
