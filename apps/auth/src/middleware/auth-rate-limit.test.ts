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
    zrem: vi.fn(async () => 1),
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
  it.each(["/internal/oauth/token", "/internal/oauth/introspect", "/internal/oauth/revoke"])(
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

describe("issuer-owned sensitive endpoint rate limits", () => {
  const cases = [
    {
      path: "/api/auth/sign-up/email",
      max: AUTH_RATE_LIMIT_POLICY.registerIpMax,
      body: { email: "new@example.com", password: "secret-password" },
    },
    {
      path: "/api/auth/request-password-reset",
      max: AUTH_RATE_LIMIT_POLICY.forgotIpMax,
      body: { email: "user@example.com" },
    },
    {
      path: "/api/auth/forget-password",
      max: AUTH_RATE_LIMIT_POLICY.forgotIpMax,
      body: { email: "user@example.com" },
    },
    {
      path: "/api/auth/change-password",
      max: AUTH_RATE_LIMIT_POLICY.setupPasswordMax,
      body: { currentPassword: "old", newPassword: "new" },
    },
    {
      path: "/api/auth/change-email",
      max: AUTH_RATE_LIMIT_POLICY.confirmEmailChangeMax,
      body: { newEmail: "new@example.com" },
    },
    {
      path: "/api/auth/phone-number/send-otp",
      max: AUTH_RATE_LIMIT_POLICY.phoneSendOtpMax,
      body: { phoneNumber: "+14155550100" },
    },
  ];

  it.each(cases)("allows $path below its Redis threshold", async ({ path, body }) => {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis([1, 1]) as never, clientIp),
    );
    app.post(path, (c) => c.json({ ok: true }));

    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(200);
  });

  it.each(cases)("blocks $path above its Redis threshold", async ({ path, max, body }) => {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis([max + 1]) as never, clientIp),
    );
    app.post(path, (c) => c.json({ ok: true }));

    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it.each([
    {
      path: "/api/auth/sign-up/email",
      max: AUTH_RATE_LIMIT_POLICY.registerEmailMax,
    },
    {
      path: "/api/auth/request-password-reset",
      max: AUTH_RATE_LIMIT_POLICY.forgotEmailMax,
    },
  ])("enforces the normalized email bucket for $path", async ({ path, max }) => {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis([1, max + 1]) as never, clientIp),
    );
    app.post(path, (c) => c.json({ ok: true }));

    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " USER@example.com " }),
    });

    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});

describe("sign-in rate limit", () => {
  function createSignInApp(counts: number[], responseStatus = 200) {
    const app = new Hono();
    const redis = buildFakeRedis(counts);
    app.use("/api/auth/*", createAuthIssuerRateLimitMiddleware(redis as never, clientIp));
    app.post("/api/auth/sign-in/email", (c) =>
      c.json({ ok: responseStatus < 400 }, responseStatus as 200),
    );
    return { app, redis };
  }

  it("blocks repeated attempts for one normalized email", async () => {
    const { app, redis } = createSignInApp([AUTH_RATE_LIMIT_POLICY.signInEmailMax + 1]);
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: " USER@example.com " }),
    });
    expect(response.status).toBe(429);
    expect(redis.zrem).not.toHaveBeenCalled();
  });

  it("removes a valid attempt from the email and shared-IP failure buckets", async () => {
    const { app, redis } = createSignInApp([1, AUTH_RATE_LIMIT_POLICY.signInMax]);
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(response.status).toBe(200);
    expect(redis.zrem).toHaveBeenCalledTimes(2);
  });

  it("retains a rejected sign-in in both failure buckets", async () => {
    const { app, redis } = createSignInApp([1, 1], 401);
    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });
    expect(response.status).toBe(401);
    expect(redis.zrem).not.toHaveBeenCalled();
  });

  it("allows four successful sign-ins from one IP inside ten seconds", async () => {
    const { app, redis } = createSignInApp(Array.from({ length: 8 }, () => 1));

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await app.request("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `user-${attempt}@example.com` }),
      });
      expect(response.status).toBe(200);
    }

    expect(redis.zrem).toHaveBeenCalledTimes(8);
  });
});
