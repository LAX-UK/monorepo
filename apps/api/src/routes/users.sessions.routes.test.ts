import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createUserRoutes } from "./users.js";

const FAKE_COOKIE = "better-auth.session_token=test-session-token-fixture";

function makeAuthDbForSessions(opts: {
  lastPasswordAuthAt: Date | null;
  hasCredential: boolean;
}) {
  let limitCall = 0;
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            limitCall += 1;
            if (limitCall === 1) return [{ lastPasswordAuthAt: opts.lastPasswordAuthAt }];
            return opts.hasCredential ? [{ id: "cred-fixture" }] : [];
          }),
        })),
      })),
    })),
  };
}

function sessionsTestApp(opts: {
  authDb: ReturnType<typeof makeAuthDbForSessions>;
  listForUser: ReturnType<typeof vi.fn>;
  deleteSessionForUser: ReturnType<typeof vi.fn>;
}) {
  const sessionRevocation = {
    listForUser: opts.listForUser,
    deleteSessionForUser: opts.deleteSessionForUser,
    getSessionIdForCookieToken: vi.fn(),
    revokeAllForUserExcept: vi.fn(),
  };
  const container = {
    env: {},
    authDb: opts.authDb,
    sessionRevocation,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    authAuditPublisher: { publish: vi.fn().mockResolvedValue(undefined) },
    transactionRunner: {
      runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
    } as never,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", staffRole: null }),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, sessionRevocation };
}

describe("DELETE /users/me/sessions/:sessionId", () => {
  it("allows OAuth-only user (no credential) to revoke another session", async () => {
    const authDb = makeAuthDbForSessions({ lastPasswordAuthAt: null, hasCredential: false });
    const otherId = "other-session-id";
    const listForUser = vi.fn().mockResolvedValue([
      {
        id: "current-sess",
        token: "test-session-token-fixture",
        createdAt: new Date(),
        expiresAt: new Date(),
        ipAddress: null,
        userAgent: null,
        lastPasswordAuthAt: null,
      },
      {
        id: otherId,
        token: "other-token",
        createdAt: new Date(),
        expiresAt: new Date(),
        ipAddress: null,
        userAgent: null,
        lastPasswordAuthAt: null,
      },
    ]);
    const deleteSessionForUser = vi.fn().mockResolvedValue(true);
    const { app } = sessionsTestApp({
      authDb,
      listForUser,
      deleteSessionForUser,
    });

    const res = await app.request(`/users/me/sessions/${otherId}`, {
      method: "DELETE",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(204);
    expect(deleteSessionForUser).toHaveBeenCalledWith("u1", otherId);
  });

  it("returns recent_auth_required for password user without fresh proof", async () => {
    const stale = new Date(Date.now() - 20 * 60 * 1000);
    const authDb = makeAuthDbForSessions({ lastPasswordAuthAt: stale, hasCredential: true });
    const listForUser = vi.fn();
    const deleteSessionForUser = vi.fn();
    const { app } = sessionsTestApp({ authDb, listForUser, deleteSessionForUser });

    const res = await app.request("/users/me/sessions/other-session-id", {
      method: "DELETE",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
    expect(deleteSessionForUser).not.toHaveBeenCalled();
  });
});

describe("POST /users/me/sessions/revoke-all", () => {
  it("allows OAuth-only user to revoke all others", async () => {
    const authDb = makeAuthDbForSessions({ lastPasswordAuthAt: null, hasCredential: false });
    const listForUser = vi.fn();
    const deleteSessionForUser = vi.fn();
    const getSessionIdForCookieToken = vi.fn().mockResolvedValue("current-sess");
    const revokeAllForUserExcept = vi.fn().mockResolvedValue(undefined);

    const container = {
      env: {},
      authDb,
      sessionRevocation: {
        listForUser,
        deleteSessionForUser,
        getSessionIdForCookieToken,
        revokeAllForUserExcept,
      },
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      authAuditPublisher: { publish: vi.fn().mockResolvedValue(undefined) },
      transactionRunner: {
        runInTransaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
      } as never,
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", staffRole: null }),
    };
    const app = new Hono();
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/sessions/revoke-all", {
      method: "POST",
      headers: { cookie: FAKE_COOKIE },
    });

    expect(res.status).toBe(200);
    expect(revokeAllForUserExcept).toHaveBeenCalledWith("u1", "current-sess");
  });
});

describe("POST /users/me/delete step-up", () => {
  it("still returns credential_required for OAuth-only users", async () => {
    const authDb = makeAuthDbForSessions({ lastPasswordAuthAt: null, hasCredential: false });
    const sessionRevocation = {
      listForUser: vi.fn(),
      deleteSessionForUser: vi.fn(),
      getSessionIdForCookieToken: vi.fn(),
      revokeAllForUserExcept: vi.fn(),
    };
    const container = {
      env: {},
      authDb,
      sessionRevocation,
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      authAuditPublisher: { publish: vi.fn() },
      db: {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([{ deletionRequestedAt: null }]),
            })),
          })),
        })),
      },
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({ id: "u1", role: "client", staffRole: null }),
    };
    const app = new Hono();
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/delete", {
      method: "POST",
      headers: {
        cookie: FAKE_COOKIE,
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("credential_required");
  });
});
