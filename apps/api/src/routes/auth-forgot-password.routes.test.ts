import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createAuthRoutes } from "./auth.js";

/** Drizzle query builders are deeply chained; tests provide a minimal stub
 * keyed by the `from()` target so the route can compose its two queries.
 */
type UserRow = { id: string; email: string; name: string | null };
type AccountRow = { providerId: string };

type FakeDbOpts = {
  /** Result of the first .from(user)...limit(1) call. */
  userResult: UserRow[];
  /** Result of the second .from(account) call. */
  accountResult: AccountRow[];
};

function buildFakeDb({ userResult, accountResult }: FakeDbOpts) {
  let userCall = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn((tableRef: { _: { name?: string } } | object) => {
        // Drizzle table refs expose their name through Symbol.toStringTag
        // (or a private symbol), but in this stub we discriminate by call
        // order: user query is always issued first, account query second.
        const targetIsUser = userCall === 0;
        userCall += 1;
        if (targetIsUser) {
          void tableRef;
          return {
            where: vi.fn(() => ({
              limit: vi.fn(async () => userResult),
            })),
          };
        }
        return {
          where: vi.fn(async () => accountResult),
        };
      }),
    })),
  };
}

function buildFakeRedis() {
  return {
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
  };
}

function mountAuth(opts: {
  db: object;
  emailEnqueue?: ReturnType<typeof vi.fn>;
  requestPasswordReset?: ReturnType<typeof vi.fn>;
}) {
  const enqueue = opts.emailEnqueue ?? vi.fn(async () => ({ outboxId: "out-1" }));
  const requestPasswordReset = opts.requestPasswordReset ?? vi.fn(async () => ({ status: true }));
  const container = {
    env: { BETTER_AUTH_SECRET: "test", WEB_ORIGIN: "http://localhost:3000" },
    db: opts.db,
    redis: buildFakeRedis(),
    auth: {
      api: {
        getSession: vi.fn(async () => null),
        requestPasswordReset,
      },
    },
    userService: {},
    emailService: { enqueue },
  };
  const app = new Hono().route("/auth", createAuthRoutes(container as never));
  return { app, enqueue, requestPasswordReset };
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
    const db = buildFakeDb({ userResult: [], accountResult: [] });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db });

    const res = await callForgotPassword(app, "nobody@example.com");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe('{"ok":true}');
    await flushSideEffects();
    expect(enqueue).not.toHaveBeenCalled();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("still triggers Better Auth reset for an unverified credential user", async () => {
    const db = buildFakeDb({
      userResult: [{ id: "u-unv", email: "new@example.com", name: "N" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, requestPasswordReset } = mountAuth({ db });

    const res = await callForgotPassword(app, "new@example.com");
    expect(res.status).toBe(200);
    await flushSideEffects();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("returns {ok:true} for a credential user and triggers Better Auth reset exactly once", async () => {
    const db = buildFakeDb({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db });

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

  it("returns {ok:true} for an oauth-only user and enqueues a tailored email exactly once", async () => {
    const db = buildFakeDb({
      userResult: [{ id: "u2", email: "bob@example.com", name: null }],
      accountResult: [{ providerId: "google" }],
    });
    const { app, enqueue, requestPasswordReset } = mountAuth({ db });

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
      const db = buildFakeDb({ userResult: [], accountResult: [] });
      const { app } = mountAuth({ db });
      const res = await callForgotPassword(app, "nobody@example.com");
      responses.push(await res.text());
    }
    {
      const db = buildFakeDb({
        userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
        accountResult: [{ providerId: "credential" }],
      });
      const { app } = mountAuth({ db });
      const res = await callForgotPassword(app, "alice@example.com");
      responses.push(await res.text());
    }
    {
      const db = buildFakeDb({
        userResult: [{ id: "u2", email: "bob@example.com", name: null }],
        accountResult: [{ providerId: "apple" }],
      });
      const { app } = mountAuth({ db });
      const res = await callForgotPassword(app, "bob@example.com");
      responses.push(await res.text());
    }

    expect(new Set(responses).size).toBe(1);
    expect(responses[0]).toBe('{"ok":true}');
  });

  it("still returns {ok:true} when Better Auth requestPasswordReset throws (no leak)", async () => {
    const db = buildFakeDb({
      userResult: [{ id: "u1", email: "alice@example.com", name: "Alice" }],
      accountResult: [{ providerId: "credential" }],
    });
    const requestPasswordReset = vi.fn(async () => {
      throw new Error("rate-limited");
    });
    const { app } = mountAuth({ db, requestPasswordReset });
    const res = await callForgotPassword(app, "alice@example.com");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    // Background failure must not throw past the request boundary.
    await flushSideEffects();
  });
});
