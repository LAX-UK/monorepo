import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createMagicLinkRateLimitMiddleware } from "./auth-rate-limit.js";

function buildFakeRedis() {
  return {
    multi: vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [
        [null, 0],
        [null, 0],
        [null, 1],
        [null, 1],
      ]),
    })),
  };
}

describe("createMagicLinkRateLimitMiddleware", () => {
  it("passes through non-magic-link routes", async () => {
    const app = new Hono();
    app.use("*", createMagicLinkRateLimitMiddleware(buildFakeRedis() as never));
    app.post("/api/auth/sign-in/email", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/sign-in/email", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("rate-limits magic-link sign-in POST", async () => {
    const redis = buildFakeRedis();
    redis.multi = vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => [
        [null, 0],
        [null, 0],
        [null, 1],
        [null, 10],
      ]),
    }));
    const app = new Hono();
    app.use("*", createMagicLinkRateLimitMiddleware(redis as never));
    app.post("/api/auth/sign-in/magic-link", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(429);
  });
});
