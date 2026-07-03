import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { DrizzleUserEmailChangeRepository } from "../repositories/drizzle-user-email-change.repository.js";
import { createEmailChangeToken } from "../lib/email-change-token.js";
import { createAuthRoutes } from "./auth.js";

/** Deterministic HMAC input for tests only (not a production credential). */
const fixtureHmacKey = ["vitest", "email-change", "routes", "fixture"].join(":");

type UserRow = {
  id: string;
  email: string;
  pendingNewEmail: string | null;
  emailChangeOldOk: boolean;
  emailChangeNewOk: boolean;
  emailChangeExpiresAt: Date | null;
};

function createTxMock(initial: UserRow, opts?: { otherUserOnThirdLimit?: boolean }) {
  const state: UserRow = { ...initial };
  let limitCalls = 0;
  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            limitCalls += 1;
            if (limitCalls >= 3) {
              return opts?.otherUserOnThirdLimit ? [{ id: "other-user" }] : [];
            }
            return [{ ...state }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (patch: Partial<UserRow>) => ({
        where: async () => {
          Object.assign(state, patch);
        },
      }),
    }),
  };
  const db = {
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<boolean>) => fn(tx)),
  };
  return { db, getState: () => state, getLimitCalls: () => limitCalls };
}

/**
 * Fake session token included in requests that reach `requireRecentPasswordAuth`.
 * The value must match what `extractBetterAuthSessionToken` can parse.
 */
const FAKE_SESSION_COOKIE = "better-auth.session_token=test-session-token-fixture";

/**
 * Minimal `authDb` stub for `requireRecentPasswordAuth`.
 *
 * Call order mirrors the middleware:
 *  1st `.limit()` → session row with recent `lastPasswordAuthAt`
 *  2nd `.limit()` → credential account row (non-empty → triggers the age check,
 *                   which passes because `lastPasswordAuthAt` is fresh)
 *
 * Routes that use `container.authDb` directly (e.g. `POST /confirm-email-change`)
 * receive a dedicated `authDb` override through the second parameter of `mountAuthDb`.
 */
function makeRecentAuthDb() {
  let callIdx = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            callIdx += 1;
            if (callIdx === 1) return [{ lastPasswordAuthAt: new Date() }];
            // Return a fake credential row so the middleware enforces the age check
            // (which passes because lastPasswordAuthAt is fresh).
            return [{ id: "cred-fixture" }];
          }),
        })),
      })),
    })),
  };
}

function mountAuthDb(db: object, authDb: object = db) {
  const container = {
    env: {
      BETTER_AUTH_SECRET: fixtureHmacKey,
      WEB_ORIGIN: "http://localhost:3000",
      LOG_LEVEL: "error",
      NODE_ENV: "test",
    },
    db,
    /** POST /auth/confirm-email-change writes `user.email` + `user.email_verified`,
     * which `api_app` is intentionally denied. The route runs that transaction
     * through `container.authDb` (auth_app role). Tests default `authDb` to the
     * same mock as `db` so existing scenarios don't have to be rewritten. */
    authDb,
    auth: {
      api: {
        getSession: vi.fn(async () => ({ user: { id: "u1" } })),
      },
    },
    authenticator: {
      getSessionUser: vi.fn(async () => ({ id: "u1", role: "client" as const, staffRole: null })),
    },
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    sessionRevocation: { revokeAllForUser: vi.fn(async () => 0) },
    userService: { getById: vi.fn(async () => null) },
    userEmailChangeRepository: new DrizzleUserEmailChangeRepository(db as never),
    emailService: { enqueue: vi.fn() },
    authAuditPublisher: { publish: vi.fn(async () => {}) },
  };
  const app = new Hono().route("/auth", createAuthRoutes(container as never));
  return { app, auth: container.auth };
}

describe("POST /auth/confirm-email-change", () => {
  it("returns 400 when token is missing", async () => {
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns 409 for stale_flow when pending email no longer matches", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: null,
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("no longer matches");
  });

  it("returns 410 when the change window has expired", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() - 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(410);
  });

  it("returns 409 when the new address is taken by another user", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "new",
      },
      fixtureHmacKey,
      3600,
    );
    const { db } = createTxMock(
      {
        id: "u1",
        email: "old@example.com",
        pendingNewEmail: "new@example.com",
        emailChangeOldOk: true,
        emailChangeNewOk: false,
        emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
      },
      { otherUserOnThirdLimit: true },
    );
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toContain("already in use");
  });

  it("returns completed false with a guidance message after the first confirmation", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "old",
      },
      fixtureHmacKey,
      3600,
    );
    const { db, getState } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: false,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { completed?: boolean; message?: string };
    expect(body.completed).toBe(false);
    expect(body.message).toContain("new address");
    expect(getState().emailChangeOldOk).toBe(true);
    expect(getState().emailChangeNewOk).toBe(false);
  });

  it("returns completed true when both sides have confirmed", async () => {
    const token = createEmailChangeToken(
      {
        userId: "u1",
        oldEmail: "old@example.com",
        newEmail: "new@example.com",
        confirmFor: "new",
      },
      fixtureHmacKey,
      3600,
    );
    const { db, getState } = createTxMock({
      id: "u1",
      email: "old@example.com",
      pendingNewEmail: "new@example.com",
      emailChangeOldOk: true,
      emailChangeNewOk: false,
      emailChangeExpiresAt: new Date(Date.now() + 86_400_000),
    });
    const { app } = mountAuthDb(db);
    const res = await app.request("/auth/confirm-email-change", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { completed?: boolean };
    expect(body.completed).toBe(true);
    expect(getState().email).toBe("new@example.com");
    expect(getState().pendingNewEmail).toBeNull();
  });
});

describe("DELETE /auth/change-email", () => {
  it("returns 401 without a session", async () => {
    const db = { transaction: vi.fn() };
    const container = {
      env: { BETTER_AUTH_SECRET: fixtureHmacKey, WEB_ORIGIN: "http://localhost:3000" },
      db,
      authDb: db,
      auth: { api: { getSession: vi.fn(async () => null) } },
      authenticator: { getSessionUser: vi.fn(async () => null) },
      userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
      sessionRevocation: { revokeAllForUser: vi.fn(async () => {}) },
      userService: { getById: vi.fn(async () => null) },
      userEmailChangeRepository: new DrizzleUserEmailChangeRepository(db as never),
      emailService: { enqueue: vi.fn() },
      authAuditPublisher: { publish: vi.fn(async () => {}) },
    };
    const app = new Hono().route("/auth", createAuthRoutes(container as never));
    const res = await app.request("/auth/change-email", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no change is in progress", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ pendingNewEmail: null }]);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(),
    };
    // Use a dedicated authDb so requireRecentPasswordAuth can validate the session
    // independently from the route's own DB queries.
    const { app } = mountAuthDb(db, makeRecentAuthDb());
    const res = await app.request("/auth/change-email", {
      method: "DELETE",
      headers: { cookie: FAKE_SESSION_COOKIE },
    });
    expect(res.status).toBe(400);
    expect(db.update).not.toHaveBeenCalled();
  });

  it("clears pending fields when a change is active", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ pendingNewEmail: "next@example.com" }]);
    const setSpy = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({ set: setSpy })),
    };
    // Use a dedicated authDb so requireRecentPasswordAuth can validate the session
    // independently from the route's own DB queries.
    const { app } = mountAuthDb(db, makeRecentAuthDb());
    const res = await app.request("/auth/change-email", {
      method: "DELETE",
      headers: { cookie: FAKE_SESSION_COOKIE },
    });
    expect(res.status).toBe(200);
    expect(db.update).toHaveBeenCalled();
    expect(setSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
      }),
    );
  });
});
