import { AUTH_RATE_LIMIT_POLICY } from "@auction/auth";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createSendVerificationIssuerRateLimitMiddleware } from "./auth-rate-limit.js";

function buildFakeRedis(counts: number[]) {
  let call = 0;
  return {
    multi: vi.fn(() => ({
      zadd: vi.fn().mockReturnThis(),
      zremrangebyscore: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      exec: vi.fn(async () => {
        const count = counts[Math.min(call, counts.length - 1)] ?? 1;
        call += 1;
        return [
          [null, 0],
          [null, 0],
          [null, 1],
          [null, count],
        ];
      }),
    })),
  };
}

function createApp(counts: number[]) {
  const app = new Hono();
  app.use(
    "/api/auth/*",
    createSendVerificationIssuerRateLimitMiddleware(buildFakeRedis(counts) as never),
  );
  app.post("/api/auth/send-verification-email", (c) => c.json({ ok: true }));
  return app;
}

describe("standalone verification email rate limit", () => {
  it("allows requests under both shared limits", async () => {
    const response = await createApp([1, 1]).request("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(response.status).toBe(200);
  });

  it("blocks requests over the IP limit", async () => {
    const response = await createApp([AUTH_RATE_LIMIT_POLICY.sendVerificationIpMax + 1]).request(
      "/api/auth/send-verification-email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      },
    );
    expect(response.status).toBe(429);
  });

  it("blocks requests over the normalized email limit", async () => {
    const response = await createApp([
      1,
      AUTH_RATE_LIMIT_POLICY.sendVerificationEmailMax + 1,
    ]).request("/api/auth/send-verification-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " USER@example.com " }),
    });
    expect(response.status).toBe(429);
  });
});
