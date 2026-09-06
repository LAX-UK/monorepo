import { AUTH_RATE_LIMIT_POLICY } from "@auction/auth";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthIssuerRateLimitMiddleware,
  createMachineTokenRateLimitMiddleware,
  createSendVerificationIssuerRateLimitMiddleware,
} from "./auth-rate-limit.js";

const clientIp = () => "192.0.2.1";

function buildFakeRedis(counts: number[]) {
  let call = 0;
  return {
    zrange: vi.fn(async () => [String(Date.now() - 1_000)]),
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
    createSendVerificationIssuerRateLimitMiddleware(buildFakeRedis(counts) as never, clientIp),
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

describe("machine token rate limit", () => {
  it.each(["/internal/oauth/token", "/internal/oauth/revoke"])(
    "blocks attempts over the per-IP limit for %s",
    async (path) => {
      const app = new Hono();
      app.use(
        "/internal/oauth/*",
        createMachineTokenRateLimitMiddleware(buildFakeRedis([11]) as never, clientIp),
      );
      app.post(path, (c) => c.json({ ok: true }));

      const response = await app.request(path, { method: "POST" });
      expect(response.status).toBe(429);
    },
  );
});

describe("session read rate limit", () => {
  function createSessionApp(count: number) {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis([count]) as never, clientIp),
    );
    app.get("/api/auth/get-session", (c) => c.json({ user: null }));
    return app;
  }

  it("uses the higher read-only session threshold", async () => {
    const response = await createSessionApp(AUTH_RATE_LIMIT_POLICY.authGeneralMax + 1).request(
      "/api/auth/get-session",
    );
    expect(response.status).toBe(200);
  });

  it("still bounds abusive session polling", async () => {
    const response = await createSessionApp(AUTH_RATE_LIMIT_POLICY.sessionReadMax + 1).request(
      "/api/auth/get-session",
    );
    expect(response.status).toBe(429);
  });
});

describe("OAuth token endpoint rate limit", () => {
  it("bounds repeated authorization-code and refresh exchanges by client IP", async () => {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(
        buildFakeRedis([AUTH_RATE_LIMIT_POLICY.authGeneralMax + 1]) as never,
        clientIp,
      ),
    );
    app.post("/api/auth/oauth2/token", (c) => c.json({ ok: true }));

    const response = await app.request("/api/auth/oauth2/token", { method: "POST" });
    expect(response.status).toBe(429);
  });
});

describe("sign-in rate limit", () => {
  function createSignInApp(counts: number[]) {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis(counts) as never, clientIp),
    );
    app.post("/api/auth/sign-in/email", (c) => c.json({ ok: true }));
    return app;
  }

  it("blocks repeated attempts for one normalized email", async () => {
    const response = await createSignInApp([AUTH_RATE_LIMIT_POLICY.signInEmailMax + 1]).request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: " USER@example.com " }),
      },
    );
    expect(response.status).toBe(429);
  });

  it("allows a valid attempt below the email and shared-IP limits", async () => {
    const response = await createSignInApp([1, AUTH_RATE_LIMIT_POLICY.signInMax]).request(
      "/api/auth/sign-in/email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "user@example.com" }),
      },
    );
    expect(response.status).toBe(200);
  });
});
