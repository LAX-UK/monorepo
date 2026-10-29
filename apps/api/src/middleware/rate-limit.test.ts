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

  it("counts the accounts read per session, with its own budget, not per shared IP", async () => {
    const increment = vi.fn(async () => ({ allowed: true, remaining: 599 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/legal-entities/me", (c) => c.json({ data: [] }));

    await app.request("/legal-entities/me", {
      headers: { authorization: "Bearer session-a", "cf-connecting-ip": "203.0.113.10" },
    });
    await app.request("/legal-entities/me", {
      headers: { authorization: "Bearer session-b", "cf-connecting-ip": "203.0.113.10" },
    });

    const [first, second] = increment.mock.calls as unknown as [string, number, number][];
    expect(first?.[0]).toMatch(/^rl:session:[\w-]{32}:\/legal-entities\/me$/);
    expect(first?.[0]).not.toContain("session-a");
    expect(first?.[1]).toBe(600);
    expect(second?.[0]).not.toBe(first?.[0]);
  });

  it("answers 429 with Retry-After once a session's accounts budget is spent", async () => {
    const increment = vi.fn(async () => ({ allowed: false, remaining: 0, retryAfterSec: 12 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/legal-entities/me", (c) => c.json({ data: [] }));

    const res = await app.request("/legal-entities/me", {
      headers: { authorization: "Bearer session-a" },
    });

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
  });

  it("keeps the per-IP default for the accounts read without a session token", async () => {
    const increment = vi.fn(async () => ({ allowed: true, remaining: 119 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/legal-entities/me", (c) => c.json({ data: [] }));

    await app.request("/legal-entities/me");

    expect(increment).toHaveBeenCalledWith("rl:unknown:/legal-entities/me", 120, 60);
  });

  it("keeps the default limit for other routes", async () => {
    const increment = vi.fn(async () => ({ allowed: true, remaining: 119 }));
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/health", (c) => c.json({ ok: true }));

    await app.request("/health");

    expect(increment).toHaveBeenCalledWith("rl:unknown:/health", 120, 60);
  });

  it("allows the request when Redis is unavailable", async () => {
    const increment = vi.fn(async () => {
      throw new Error("Stream isn't writeable and enableOfflineQueue options is false");
    });
    const app = new Hono();
    app.use("*", createRateLimitMiddleware({ increment }));
    app.get("/artists/public", (c) => c.json({ ok: true }));

    const response = await app.request("/artists/public");

    expect(response.status).toBe(200);
  });
});
