import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import { createProductAuthRoutes } from "./auth.js";

/** Legacy query-builder fixtures retained for route response compatibility.
 * production routes them through different Postgres roles.
 */
type UserRow = { id: string; email: string; name: string | null };
type AccountRow = { providerId: string };

function buildFakeUserDb(userResult: UserRow[]) {
  return {
    rows: userResult,
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
    rows: accountResult,
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
    identityDb: buildFakeAuthDb(opts.accountResult),
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
  identityDb: object;
  emailEnqueue?: ReturnType<typeof vi.fn>;
  requestPasswordReset?: ReturnType<typeof vi.fn>;
  requestMagicLink?: ReturnType<typeof vi.fn>;
}) {
  const enqueue = opts.emailEnqueue ?? vi.fn(async () => ({ outboxId: "out-1" }));
  const requestPasswordReset = opts.requestPasswordReset ?? vi.fn(async () => {});
  const requestMagicLink = opts.requestMagicLink ?? vi.fn(async () => {});
  const env = {
    CHECK_IN_TOKEN_SECRET: "test-secret-at-least-16-characters",
    WEB_ORIGIN: "http://localhost:3000",
    API_PUBLIC_URL: "http://localhost:4000",
  };
  const identityIssuer = {
    signUpEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    requestPasswordReset,
    requestMagicLink,
    findSubjectByEmail: vi.fn(async () => {
      const found = (opts.db as { rows?: UserRow[] }).rows?.[0];
      return found
        ? { id: found.id, email: found.email, name: found.name ?? "", emailVerified: false }
        : null;
    }),
    credentialSummary: vi.fn(async () => {
      const providers =
        (opts.identityDb as { rows?: AccountRow[] }).rows?.map((row) => row.providerId) ?? [];
      return {
        hasPassword: providers.includes("credential"),
        linkedProviders: providers,
      };
    }),
  };
  const authAuditPublisher = { publish: vi.fn(async () => {}) };
  const emailService = { enqueue };
  const container = {
    env,
    db: opts.db,
    redis: buildFakeRedis(),
    identityIssuer: identityIssuer as never,
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
        identityIssuer: identityIssuer as never,
        userService: {} as never,
        emailService: emailService as never,
        authAuditPublisher,
        authCredentialReader: { hasCredentialAccount: vi.fn(async () => false) },
      }),
    },
  };
  const app = new Hono().route("/auth", createProductAuthRoutes(container as never));
  return { app, enqueue, requestPasswordReset, requestMagicLink };
}

async function callForgotPassword(app: Hono, email: string) {
  return app.request("/auth/forgot-password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

/** Side-effects (DB lookup, email enqueue, Identity issuer reset) are
 * dispatched fire-and-forget so the response latency does not depend on
 * the email being registered. Tests need to flush the queued microtasks
 * before asserting on the mocked side effects.
 */
async function flushSideEffects(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("POST /auth/forgot-password (provider-aware)", () => {
  it("returns identical {ok:true} for an unknown email and enqueues nothing", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({ userResult: [], accountResult: [] });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, identityDb });

    const res = await callForgotPassword(app, "nobody@example.com");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('{"ok":true}');
    await flushSideEffects();
    expect(enqueue).not.toHaveBeenCalled();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("still triggers an issuer reset for an unverified credential user", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u-unv", email: "new@example.com", name: "N" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, requestPasswordReset } = mountAuth({ db, identityDb });

    const res = await callForgotPassword(app, "new@example.com");
    expect(res.status).toBe(200);
    await flushSideEffects();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("returns {ok:true} for a credential user and triggers an issuer reset exactly once", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, identityDb });

    const res = await callForgotPassword(app, "alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    await flushSideEffects();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "alice@example.com",
      redirectTo: "http://localhost:3000/reset-password",
    });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("returns {ok:true} for a passwordless user and triggers magic-link sign-in", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u3", email: "seeded@example.com", name: "Seeded" }],
      accountResult: [],
    });
    const requestMagicLink = vi.fn(async () => {});
    const { app, enqueue, requestPasswordReset } = mountAuth({
      db,
      identityDb,
      requestMagicLink,
    });

    const res = await callForgotPassword(app, "seeded@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    await flushSideEffects();
    expect(requestPasswordReset).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(requestMagicLink).toHaveBeenCalledWith({
      email: "seeded@example.com",
      callbackURL: "http://localhost:3000/auth/activate/set-password",
      errorCallbackURL: "http://localhost:3000/auth/activate/expired",
    });
  });

  it("returns {ok:true} for an oauth-only user and enqueues a tailored email exactly once", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u2", email: "bob@example.com", name: null }],
      accountResult: [{ providerId: "google" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db, identityDb });

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
        userName: "",
      },
    });
  });

  it("emits a byte-identical {ok:true} response across all three branches", async () => {
    const responses: string[] = [];

    {
      const { db, identityDb } = buildForgotPasswordDbPair({ userResult: [], accountResult: [] });
      const { app } = mountAuth({ db, identityDb });
      const res = await callForgotPassword(app, "nobody@example.com");
      responses.push(await res.text());
    }
    {
      const { db, identityDb } = buildForgotPasswordDbPair({
        userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
        accountResult: [{ providerId: "credential" }],
      });
      const { app } = mountAuth({ db, identityDb });
      const res = await callForgotPassword(app, "alice@example.com");
      responses.push(await res.text());
    }
    {
      const { db, identityDb } = buildForgotPasswordDbPair({
        userResult: [{ id: "u2", email: "bob@example.com", name: null }],
        accountResult: [{ providerId: "apple" }],
      });
      const { app } = mountAuth({ db, identityDb });
      const res = await callForgotPassword(app, "bob@example.com");
      responses.push(await res.text());
    }

    expect(new Set(responses).size).toBe(1);
    expect(responses[0]).toBe('{"ok":true}');
  });

  it("still returns {ok:true} when the issuer reset request throws (no leak)", async () => {
    const { db, identityDb } = buildForgotPasswordDbPair({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const requestPasswordReset = vi.fn(async () => {
      throw new Error("rate-limited");
    });
    const { app } = mountAuth({ db, identityDb, requestPasswordReset });
    const res = await callForgotPassword(app, "alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    // Background failure must not throw past the request boundary.
    await flushSideEffects();
  });
});
