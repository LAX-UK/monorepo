import { AUTH_RATE_LIMIT_POLICY } from "@auction/auth";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  createAuthIssuerRateLimitMiddleware,
  createMachineTokenRateLimitMiddleware,
  createSendVerificationIssuerRateLimitMiddleware,
} from "./auth-rate-limit.js";
import {
  createInProcessSlidingWindowStore,
  createResilientSlidingWindowStore,
} from "./resilient-sliding-window-store.js";

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

describe("LAX Account route rate limit", () => {
  function createAccountApp(count: number) {
    const app = new Hono();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(buildFakeRedis([count]) as never, clientIp),
    );
    app.post("/api/auth/lax/account-sessions", (c) => c.json({ ok: true }));
    app.post("/api/auth/lax/account-sessions/revoke-others", (c) => c.json({ ok: true }));
    app.post("/api/auth/lax/account-security-facts", (c) => c.json({ ok: true }));
    return app;
  }

  it.each([
    "/api/auth/lax/account-sessions",
    "/api/auth/lax/account-sessions/revoke-others",
    "/api/auth/lax/account-security-facts",
  ])("lets the Account server call %s past the general per-IP budget", async (path) => {
    const response = await createAccountApp(AUTH_RATE_LIMIT_POLICY.authGeneralMax + 1).request(
      path,
      { method: "POST" },
    );
    expect(response.status).toBe(200);
  });

  it("still bounds floods against the account routes", async () => {
    const response = await createAccountApp(AUTH_RATE_LIMIT_POLICY.accountRouteMax + 1).request(
      "/api/auth/lax/account-sessions",
      { method: "POST" },
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

describe("two-factor code throttle", () => {
  const verify = "/api/auth/two-factor/verify-totp";

  function createTwoFactorApp(
    status: () => number,
    resolveSubjectId?: () => Promise<string | null>,
  ) {
    const app = new Hono();
    const store = createInProcessSlidingWindowStore();
    app.use(
      "/api/auth/*",
      createAuthIssuerRateLimitMiddleware(
        store,
        clientIp,
        resolveSubjectId ? { resolveSubjectId } : {},
      ),
    );
    app.all("/api/auth/two-factor/*", (c) => c.json({ ok: status() < 400 }, status() as 200));
    return app;
  }

  const post = (app: Hono, path: string, cookie?: string) =>
    app.request(path, { method: "POST", headers: cookie ? { cookie } : {} });

  it("blocks one sign-in challenge after repeated wrong codes", async () => {
    const app = createTwoFactorApp(() => 401);
    const cookie = "better-auth.two_factor=challenge-a.sig";
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax; i += 1) {
      expect((await post(app, verify, cookie)).status).toBe(401);
    }
    const blocked = await post(app, verify, cookie);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("does not lock out another account behind the same IP", async () => {
    const app = createTwoFactorApp(() => 401);
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax; i += 1) {
      await post(app, verify, "better-auth.two_factor=challenge-a.sig");
    }
    expect((await post(app, verify, "better-auth.two_factor=challenge-b.sig")).status).toBe(401);
  });

  it("keys enrolment attempts on the signed-in subject", async () => {
    const app = createTwoFactorApp(
      () => 400,
      async () => "subject-1",
    );
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax; i += 1) {
      await post(app, verify);
    }
    expect((await post(app, verify)).status).toBe(429);
  });

  it("caps a single IP at the looser ceiling even across many accounts", async () => {
    const app = createTwoFactorApp(() => 401);
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorIpMax; i += 1) {
      await post(
        app,
        "/api/auth/two-factor/verify-backup-code",
        `better-auth.two_factor=c${i}.sig`,
      );
    }
    const blocked = await post(app, verify, "better-auth.two_factor=fresh.sig");
    expect(blocked.status).toBe(429);
  });

  it("never counts correct codes", async () => {
    const app = createTwoFactorApp(() => 200);
    const cookie = "better-auth.two_factor=challenge-a.sig";
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax * 3; i += 1) {
      expect((await post(app, verify, cookie)).status).toBe(200);
    }
  });

  it.each(["/api/auth/two-factor/enable", "/api/auth/two-factor/generate-backup-codes"])(
    "does not count %s",
    async (path) => {
      const app = createTwoFactorApp(() => 401);
      for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax; i += 1) {
        await post(app, path, "better-auth.two_factor=challenge-a.sig");
      }
      expect((await post(app, verify, "better-auth.two_factor=challenge-a.sig")).status).toBe(401);
    },
  );

  it.each([500, 429])("does not count a %s answer", async (status) => {
    const app = createTwoFactorApp(() => status);
    const cookie = "better-auth.two_factor=challenge-a.sig";
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.twoFactorAccountMax + 2; i += 1) {
      expect((await post(app, verify, cookie)).status).toBe(status);
    }
  });
});

describe("Redis outage", () => {
  function failingRedis() {
    const fail = () => Promise.reject(new Error("ECONNREFUSED"));
    return {
      multi: vi.fn(() => {
        const pipeline = {
          zadd: () => pipeline,
          zremrangebyscore: () => pipeline,
          expire: () => pipeline,
          zcard: () => pipeline,
          exec: fail,
        };
        return pipeline;
      }),
      zrange: vi.fn(fail),
      zrem: vi.fn(fail),
    };
  }

  function createOutageApp(log: { warn: ReturnType<typeof vi.fn> }) {
    const app = new Hono();
    const store = createResilientSlidingWindowStore(failingRedis() as never, log);
    app.use("/api/auth/*", createAuthIssuerRateLimitMiddleware(store, clientIp));
    app.post("/api/auth/sign-in/email", (c) => c.json({ ok: false }, 401));
    return app;
  }

  const signIn = (app: Hono) =>
    app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com" }),
    });

  it("keeps serving requests instead of returning a 500", async () => {
    const response = await signIn(createOutageApp({ warn: vi.fn() }));
    expect(response.status).toBe(401);
  });

  it("still limits credential endpoints from the in-process windows", async () => {
    const app = createOutageApp({ warn: vi.fn() });
    for (let i = 0; i < AUTH_RATE_LIMIT_POLICY.signInEmailMax; i += 1) {
      expect((await signIn(app)).status).toBe(401);
    }
    const blocked = await signIn(app);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("logs the outage once per window", async () => {
    const warn = vi.fn();
    const app = createOutageApp({ warn });
    for (let i = 0; i < 3; i += 1) await signIn(app);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      { errorName: "Error" },
      "rate_limit_redis_unavailable_using_in_process_fallback",
    );
  });

  it("returns to Redis once it has recovered", async () => {
    let now = 1_000_000;
    const redis = failingRedis();
    const store = createResilientSlidingWindowStore(redis as never, { warn: vi.fn() }, () => now);
    await store.multi().zcard("k").exec();
    const callsDuringOutage = redis.multi.mock.calls.length;
    await store.multi().zcard("k").exec();
    expect(redis.multi.mock.calls.length).toBe(callsDuringOutage);
    now += 10_000;
    await store.multi().zcard("k").exec();
    expect(redis.multi.mock.calls.length).toBe(callsDuringOutage + 1);
  });

  it("treats a command-level pipeline error as an outage", async () => {
    const redis = {
      multi: () => {
        const pipeline = {
          zadd: () => pipeline,
          zremrangebyscore: () => pipeline,
          expire: () => pipeline,
          zcard: () => pipeline,
          exec: async () => [[new Error("READONLY"), null]],
        };
        return pipeline;
      },
    };
    const store = createResilientSlidingWindowStore(redis as never, { warn: vi.fn() });
    const results = await store.multi().zadd("k", 1, "m").zcard("k").exec();
    expect(results?.[1]?.[1]).toBe(1);
  });
});
