import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createRateLimitMiddleware } from "./rate-limit.js";

describe("general API rate limit", () => {
  it("skips rate limiting for authenticated session reads", async () => {
    const increment = vi.fn(async () => ({ allowed: true, remaining: 599 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/users/me", (c) => c.json({ ok: true }));

    const response = await app.request("/users/me", {
      headers: { "cf-connecting-ip": "203.0.113.10" },
    });

    expect(response.status).toBe(200);
    expect(increment).not.toHaveBeenCalled();
  });

  it("keeps the default limit for other routes", async () => {
    const increment = vi.fn(async () => ({ allowed: true, remaining: 119 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/health", (c) => c.json({ ok: true }));

    await app.request("/health");

    expect(increment).toHaveBeenCalledWith("rl:unknown:/health", 120, 60);
  });
});
