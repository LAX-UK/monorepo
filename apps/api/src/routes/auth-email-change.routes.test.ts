import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import { createEmailChangeToken } from "../lib/email-change-token.js";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import { createProductAuthRoutes } from "./auth.js";
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
    state,
    otherUserOnConfirmation: opts?.otherUserOnThirdLimit ?? false,
    transaction: vi.fn(async (fn: (t: typeof tx) => Promise<boolean>) => fn(tx)),
  };
  return { db, getState: () => state, getLimitCalls: () => limitCalls };
}

const API_AUTHORIZATION = "Bearer test-lax-bid-api-token";

/**
 * Legacy step-up query fixture retained by older cases.
 *
 * Call order mirrors the middleware:
 *  1st `.limit()` → session row with recent `lastPasswordAuthAt`
 *  2nd `.limit()` → credential account row (non-empty → triggers the age check,
 *                   which passes because `lastPasswordAuthAt` is fresh)
 *
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

function mountIdentity(db: object, _stepUpFixture: object = db, authenticated = true) {
  const env = {
    CHECK_IN_TOKEN_SECRET: fixtureHmacKey,
    WEB_ORIGIN: "http://localhost:3000",
    LOG_LEVEL: "error",
    NODE_ENV: "test",
  };
  const identityIssuer = {
    signUpEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    requestMagicLink: vi.fn(),
    stepUpStatus: vi.fn(async () => ({ hasCredential: true, lastPasswordAuthAt: new Date() })),
    pendingEmailChange: vi.fn(async () => {
      return (db as { state?: UserRow }).state?.pendingNewEmail ?? null;
    }),
    cancelEmailChange: vi.fn(async () => {
      const state = (db as { state?: UserRow }).state;
      if (state) {
        state.pendingNewEmail = null;
        state.emailChangeOldOk = false;
        state.emailChangeNewOk = false;
        state.emailChangeExpiresAt = null;
      }
    }),
    startEmailChange: vi.fn(async () => undefined),
    confirmEmailChange: vi.fn(
      async (input: {
        oldEmail: string;
        newEmail: string;
        confirmFor: "old" | "new";
      }) => {
        const fixture = db as { state?: UserRow; otherUserOnConfirmation?: boolean };
        const state = fixture.state;
        if (!state || state.pendingNewEmail !== input.newEmail || state.email !== input.oldEmail) {
          throw new IdentityIssuerClientError("http", "stale", 409, "stale_flow");
        }
        if (state.emailChangeExpiresAt && state.emailChangeExpiresAt.getTime() < Date.now()) {
          throw new IdentityIssuerClientError("http", "expired", 410, "expired");
        }
        if (input.confirmFor === "old") state.emailChangeOldOk = true;
        else state.emailChangeNewOk = true;
        if (!state.emailChangeOldOk || !state.emailChangeNewOk) return false;
        if (fixture.otherUserOnConfirmation) {
          throw new IdentityIssuerClientError("http", "taken", 409, "email_taken");
        }
        state.email = state.pendingNewEmail;
        state.pendingNewEmail = null;
        state.emailChangeOldOk = false;
        state.emailChangeNewOk = false;
        state.emailChangeExpiresAt = null;
        return true;
      },
    ),
  };
  const userService = { getById: vi.fn(async () => null) };
  const emailService = { enqueue: vi.fn() };
  const authAuditPublisher = { publish: vi.fn(async () => {}) };
  const container = {
    env,
    db,
    identityIssuer: identityIssuer as never,
    authenticator: {
      getSessionUser: vi.fn(async () =>
        authenticated
          ? {
              id: "u1",
              role: "client" as const,
              staffRole: null,
              identitySessionId: "identity-session-1",

              scopes: ["bid.write"],
            }
          : null,
      ),
    },
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    userService,
    emailService,
    authAuditPublisher,
    redis: null,
    identityRoutes: {
      accountSecurityHttp: new IdentityAccountSecurityHttpApplicationService({
        env: env as never,
        identityIssuer: identityIssuer as never,
        userService: userService as never,
        emailService: emailService as never,
        authAuditPublisher,
        authCredentialReader: { hasCredentialAccount: vi.fn(async () => false) },
      }),
    },
  };
  const app = new Hono().route("/auth", createProductAuthRoutes(container as never));
  return { app };
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db);
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
    const { app } = mountIdentity(db, db, false);
    const res = await app.request("/auth/change-email", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when no change is in progress", async () => {
    const selectLimit = vi.fn().mockResolvedValue([{ pendingNewEmail: null }]);
    const db = {
      state: {
        id: "u1",
        email: "old@example.com",
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: new Date(Date.now() + 60_000),
      } satisfies UserRow,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(),
    };
    // Supply a fresh step-up fixture for the protected cancellation route.
    // independently from the route's own DB queries.
    const { app } = mountIdentity(db, makeRecentAuthDb());
    const res = await app.request("/auth/change-email", {
      method: "DELETE",
      headers: { authorization: API_AUTHORIZATION },
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
      state: {
        id: "u1",
        email: "old@example.com",
        pendingNewEmail: "next@example.com",
        emailChangeOldOk: true,
        emailChangeNewOk: false,
        emailChangeExpiresAt: new Date(Date.now() + 60_000),
      } satisfies UserRow,
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: selectLimit,
          })),
        })),
      })),
      update: vi.fn(() => ({ set: setSpy })),
    };
    // Supply a fresh step-up fixture for the protected cancellation route.
    // independently from the route's own DB queries.
    const { app } = mountIdentity(db, makeRecentAuthDb());
    const res = await app.request("/auth/change-email", {
      method: "DELETE",
      headers: { authorization: API_AUTHORIZATION },
    });
    expect(res.status).toBe(200);
    expect(db.state).toEqual(
      expect.objectContaining({
        pendingNewEmail: null,
        emailChangeOldOk: false,
        emailChangeNewOk: false,
        emailChangeExpiresAt: null,
      }),
    );
  });
});
