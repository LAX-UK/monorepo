import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import { createAuthRoutes } from "./auth.js";

/** Drizzle query builders are deeply chained; tests stub `db` (user lookup,
 * `api_app`) and `authDb` (linked `account` rows, `auth_app`) separately —
 * production routes them through different Postgres roles.
 */
type UserRow = { id: string; email: string; name: string | null };
type AccountRow = { providerId: string };

function buildFakeUserDb(userResult: UserRow[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => userResult),
        })),
      })),
    })),
  };
}

function buildFakeAuthDb(accountResult: AccountRow[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(async () => accountResult),
      })),
    })),
  };
}

type FakeDbOpts = {
  userResult: UserRow[];
  accountResult: AccountRow[];
};

function buildForgotPasswordDbPair(opts: FakeDbOpts) {
  return {
    db: buildFakeUserDb(opts.userResult),
    authDb: buildFakeAuthDb(opts.accountResult),
  };
}

function buildFakeRedis() {
  return {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
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

function mountAuth(opts: {
  db: object;
  authDb: object;
  emailEnqueue?: ReturnType<typeof vi.fn>;
  requestPasswordReset?: ReturnType<typeof vi.fn>;
  authHandler?: ReturnType<typeof vi.fn>;
}) {
  const enqueue = opts.emailEnqueue ?? vi.fn(async () => ({ outboxId: "out-1" }));
  const requestPasswordReset = opts.requestPasswordReset ?? vi.fn(async () => ({ status: true }));
  const authHandler = opts.authHandler ?? vi.fn(async () => new Response(null, { status: 200 }));
  const env = {
    BETTER_AUTH_SECRET: "test",
    WEB_ORIGIN: "http://localhost:3000",
    API_PUBLIC_URL: "http://localhost:4000",
  };
  const auth = {
    api: {
      getSession: vi.fn(async () => null),
      requestPasswordReset,
    },
    handler: authHandler,
  };
  const authAuditPublisher = { publish: vi.fn(async () => {}) };
  const emailService = { enqueue };
  const container = {
    env,
    db: opts.db,
    authDb: opts.authDb,
    redis: buildFakeRedis(),
    auth,
    authenticator: {
      getSessionUser: vi.fn(async () => null),
    },
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    userService: {},
    emailService,
    authAuditPublisher,
    identityRoutes: {
      accountSecurityHttp: new IdentityAccountSecurityHttpApplicationService({
        env: env as never,
        authDb: opts.authDb as never,
        auth: auth as never,
        db: opts.db as never,
        userService: {} as never,
        userEmailChangeRepository: {} as never,
        emailService: emailService as never,
        sessionRevocation: {} as never,
        authAuditPublisher,
        authCredentialReader: { hasCredentialAccount: vi.fn(async () => false) },
      }),
    },
  };
  const app = new Hono().route("/auth", createAuthRoutes(container as never));
  return { app, enqueue, requestPasswordReset, authHandler };
}

async function callForgotPassword(app: Hono, email: string) {
  return app.request("/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/** Side-effects (DB lookup, email enqueue, Better Auth reset) are
 * dispatched fire-and-forget so the response latency does not depend on
 * the email being registered. Tests need to flush the queued microtasks
 * before asserting on the mocked side effects.
 */
async function flushSideEffects(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("POST /auth/forgot-password (provider-aware)", () => {
  it("returns identical {ok:true} for an unknown email and enqueues nothing", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({ userResult: [], accountResult: [] });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, authDb });

    const res = await callForgotPassword(app, "nobody@example.com");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('{"ok":true}');
    await flushSideEffects();
    expect(enqueue).not.toHaveBeenCalled();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("still triggers Better Auth reset for an unverified credential user", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u-unv", email: "new@example.com", name: "N" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, requestPasswordReset } = mountAuth({ db, authDb });

    const res = await callForgotPassword(app, "new@example.com");
    expect(res.status).toBe(200);
    await flushSideEffects();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("returns {ok:true} for a credential user and triggers Better Auth reset exactly once", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, authDb });

    const res = await callForgotPassword(app, "alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    await flushSideEffects();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith({
      body: {
        email: "alice@example.com",
        redirectTo: "http://localhost:3000/reset-password",
      },
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns {ok:true} for a passwordless user and triggers magic-link sign-in", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u3", email: "seeded@example.com", name: "Seeded" }],
      accountResult: [],
    });
    const authHandler = vi.fn(async (_request: Request) => new Response(null, { status: 200 }));
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, authDb, authHandler });

    const res = await callForgotPassword(app, "seeded@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    await flushSideEffects();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(authHandler).toHaveBeenCalledTimes(1);
    const req = authHandler.mock.calls[0]?.[0] as Request;
    expect(req.url).toContain("/api/auth/sign-in/magic-link");
    const body = (await req.json()) as { email: string; callbackURL: string };
    expect(body.email).toBe("seeded@example.com");
    expect(body.callbackURL).toBe("http://localhost:3000/auth/activate/set-password");
  });

  it("returns {ok:true} for an oauth-only user and enqueues a tailored email exactly once", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u2", email: "bob@example.com", name: null }],
      accountResult: [{ providerId: "google" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, authDb });

    const res = await callForgotPassword(app, "bob@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    await flushSideEffects();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(1);
    const call = enqueue.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call).toMatchObject({
      template: "oauth-account-reset-attempt",
      to: "bob@example.com",
      userId: "u2",
      category: "auth",
      vars: {
        provider: "google",
        signInUrl: "http://localhost:3000/login",
        settingsUrl: "http://localhost:3000/dashboard/settings?tab=security",
        userEmail: "bob@example.com",
        userName: null,
      },
    });
  });

  it("emits a byte-identical {ok:true} response across all three branches", async () => {
    const responses: string[] = [];

    {
      const { db, authDb } = buildForgotPasswordDbPair({ userResult: [], accountResult: [] });
      const { app } = mountAuth({ db, authDb });
      const res = await callForgotPassword(app, "nobody@example.com");
      responses.push(await res.text());
    }
    {
      const { db, authDb } = buildForgotPasswordDbPair({
        userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
        accountResult: [{ providerId: "credential" }],
      });
      const { app } = mountAuth({ db, authDb });
      const res = await callForgotPassword(app, "alice@example.com");
      responses.push(await res.text());
    }
    {
      const { db, authDb } = buildForgotPasswordDbPair({
        userResult: [{ id: "u2", email: "bob@example.com", name: null }],
        accountResult: [{ providerId: "apple" }],
      });
      const { app } = mountAuth({ db, authDb });
      const res = await callForgotPassword(app, "bob@example.com");
      responses.push(await res.text());
    }

    expect(new Set(responses).size).toBe(1);
    expect(responses[0]).toBe('{"ok":true}');
  });

  it("still returns {ok:true} when Better Auth requestPasswordReset throws (no leak)", async () => {
    const { db, authDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const requestPasswordReset = vi.fn(async () => {
      throw new Error("rate-limited");
    });
    const { app } = mountAuth({ db, authDb, requestPasswordReset });
    const res = await callForgotPassword(app, "alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    // Background failure must not throw past the request boundary.
    await flushSideEffects();
  });
});
