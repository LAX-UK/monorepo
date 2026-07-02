import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  RATE_LIMIT_CONFIG,
  createRegisterRateLimitMiddleware,
  createSendVerificationRateLimitMiddleware,
} from "./auth-rate-limit.js";

/** Fake Redis whose sliding-window zcard returns values from `counts` in call order. */
function buildFakeRedis(counts: number[]) {
  let call = 0;
  return {
    multi: vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => {
        const n = counts[Math.min(call, counts.length - 1)] ?? 1;
        call += 1;
        return [
          [null, 0],
          [null, 0],
          [null, 1],
          [null, n],
        ];
      }),
    })),
  };
}

describe("createRegisterRateLimitMiddleware", () => {
  it("passes through non-POST requests", async () => {
    const app = new Hono();
    app.use("*", createRegisterRateLimitMiddleware(buildFakeRedis([999]) as never));
    app.get("/users/register", (c) => c.json({ ok: true }));
    const res = await app.request("/users/register", { method: "GET" });
    expect(res.status).toBe(200);
  });

  it("allows registration under both limits", async () => {
    const app = new Hono();
    app.use("*", createRegisterRateLimitMiddleware(buildFakeRedis([1, 1]) as never));
    app.post("/users/register", (c) => c.json({ ok: true }));
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("429s over the IP limit", async () => {
    const app = new Hono();
    const redis = buildFakeRedis([RATE_LIMIT_CONFIG.registerIpMax + 1]);
    app.use("*", createRegisterRateLimitMiddleware(redis as never));
    app.post("/users/register", (c) => c.json({ ok: true }));
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(429);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("rate_limited");
  });

  it("429s over the per-email limit even when IP is under", async () => {
    const app = new Hono();
    const redis = buildFakeRedis([1, RATE_LIMIT_CONFIG.registerEmailMax + 1]);
    app.use("*", createRegisterRateLimitMiddleware(redis as never));
    app.post("/users/register", (c) => c.json({ ok: true }));
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(429);
    const json = (await res.json()) as { code?: string };
    expect(json.code).toBe("rate_limited");
  });

  it("skips the email bucket when the body has no email", async () => {
    const app = new Hono();
    const redis = buildFakeRedis([1, 999]);
    app.use("*", createRegisterRateLimitMiddleware(redis as never));
    app.post("/users/register", (c) => c.json({ ok: true }));
    const res = await app.request("/users/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
  });
});

describe("createSendVerificationRateLimitMiddleware", () => {
  it("passes through unrelated auth routes", async () => {
    const app = new Hono();
    app.use("*", createSendVerificationRateLimitMiddleware(buildFakeRedis([999]) as never));
    app.post("/api/auth/sign-in/email", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/sign-in/email", { method: "POST" });
    expect(res.status).toBe(200);
  });

  it("allows resend under both limits", async () => {
    const app = new Hono();
    app.use("*", createSendVerificationRateLimitMiddleware(buildFakeRedis([1, 1]) as never));
    app.post("/api/auth/send-verification-email", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(200);
  });

  it("429s over the IP limit", async () => {
    const app = new Hono();
    const redis = buildFakeRedis([RATE_LIMIT_CONFIG.sendVerificationIpMax + 1]);
    app.use("*", createSendVerificationRateLimitMiddleware(redis as never));
    app.post("/api/auth/send-verification-email", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(429);
  });

  it("429s over the per-email limit even when IP is under", async () => {
    const app = new Hono();
    const redis = buildFakeRedis([1, RATE_LIMIT_CONFIG.sendVerificationEmailMax + 1]);
    app.use("*", createSendVerificationRateLimitMiddleware(redis as never));
    app.post("/api/auth/send-verification-email", (c) => c.json({ ok: true }));
    const res = await app.request("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(res.status).toBe(429);
  });
});
