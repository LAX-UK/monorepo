import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { Container } from "../container.js";
import { createUserRouteServices } from "../container/create-user-route-services.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createTestUserRouteServicesInput } from "../testing/create-test-user-route-services.js";
import { createUserRoutes } from "./users.js";

const API_AUTHORIZATION = "Bearer test-lax-bid-api-token";

function makeIdentityStepUpClient(opts: {
  lastPasswordAuthAt: Date | null;
  hasCredential: boolean;
}) {
  return {
    stepUpStatus: vi.fn(async () => ({
      lastPasswordAuthAt: opts.lastPasswordAuthAt,
      hasCredential: opts.hasCredential,
    })),
  };
}

function sessionsTestApp(opts: {
  identityIssuer: ReturnType<typeof makeIdentityStepUpClient>;
  listForUser: ReturnType<typeof vi.fn>;
  deleteSessionForUser: ReturnType<typeof vi.fn>;
  getSessionIdForCookieToken?: ReturnType<typeof vi.fn>;
  revokeAllForUserExcept?: ReturnType<typeof vi.fn>;
}) {
  const sessionRevocation = {
    listForUser: opts.listForUser,
    deleteSessionForUser: opts.deleteSessionForUser,
    getSessionIdForCookieToken: opts.getSessionIdForCookieToken ?? vi.fn(),
    revokeAllForUserExcept: opts.revokeAllForUserExcept ?? vi.fn(),
  };
  const userRoutes = createUserRouteServices(
    createTestUserRouteServicesInput({
      sessionRevocation: sessionRevocation as never,
      authAuditPublisher: { publish: vi.fn().mockResolvedValue(undefined) } as never,
    }),
  );
  const container = {
    env: {},
    identityIssuer: opts.identityIssuer,
    userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
    userRoutes,
  } as unknown as Container;
  const authenticator: IAuthenticator = {
    getSessionUser: vi.fn().mockResolvedValue({
      id: "u1",
      role: "client",
      staffRole: null,
      identitySessionId: "identity-session-1",

      scopes: ["bid.write"],
    }),
  };
  const app = new Hono();
  app.route("/users", createUserRoutes(container, authenticator));
  return { app, sessionRevocation };
}

describe("DELETE /users/me/sessions/:sessionId", () => {
  it("allows OAuth-only user (no credential) to revoke another session", async () => {
    const identityIssuer = makeIdentityStepUpClient({
      lastPasswordAuthAt: null,
      hasCredential: false,
    });
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
      identityIssuer,
      listForUser,
      deleteSessionForUser,
    });

    const res = await app.request(`/users/me/sessions/${otherId}`, {
      method: "DELETE",
      headers: { authorization: API_AUTHORIZATION },
    });

    expect(res.status).toBe(204);
    expect(deleteSessionForUser).toHaveBeenCalledWith("u1", otherId);
  });

  it("returns recent_auth_required for password user without fresh proof", async () => {
    const stale = new Date(Date.now() - 20 * 60 * 1000);
    const identityIssuer = makeIdentityStepUpClient({
      lastPasswordAuthAt: stale,
      hasCredential: true,
    });
    const listForUser = vi.fn();
    const deleteSessionForUser = vi.fn();
    const { app } = sessionsTestApp({ identityIssuer, listForUser, deleteSessionForUser });

    const res = await app.request("/users/me/sessions/other-session-id", {
      method: "DELETE",
      headers: { authorization: API_AUTHORIZATION },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("recent_auth_required");
    expect(deleteSessionForUser).not.toHaveBeenCalled();
  });
});

describe("POST /users/me/sessions/revoke-all", () => {
  it("allows OAuth-only user to revoke all others", async () => {
    const identityIssuer = makeIdentityStepUpClient({
      lastPasswordAuthAt: null,
      hasCredential: false,
    });
    const listForUser = vi.fn();
    const deleteSessionForUser = vi.fn();
    const getSessionIdForCookieToken = vi.fn().mockResolvedValue("current-sess");
    const revokeAllForUserExcept = vi.fn().mockResolvedValue(undefined);

    const { app } = sessionsTestApp({
      identityIssuer,
      listForUser,
      deleteSessionForUser,
      getSessionIdForCookieToken,
      revokeAllForUserExcept,
    });

    const res = await app.request("/users/me/sessions/revoke-all", {
      method: "POST",
      headers: { authorization: API_AUTHORIZATION },
    });

    expect(res.status).toBe(200);
    expect(revokeAllForUserExcept).toHaveBeenCalledWith("u1", "identity-session-1");
  });
});

describe("POST /users/me/delete step-up", () => {
  it("still returns credential_required for OAuth-only users", async () => {
    const identityIssuer = makeIdentityStepUpClient({
      lastPasswordAuthAt: null,
      hasCredential: false,
    });
    const container = {
      env: {},
      identityIssuer,
      userSuspensionChecker: { isSuspended: vi.fn().mockResolvedValue(false) },
      userRoutes: createUserRouteServices(createTestUserRouteServicesInput()),
    } as unknown as Container;
    const authenticator: IAuthenticator = {
      getSessionUser: vi.fn().mockResolvedValue({
        id: "u1",
        role: "client",
        staffRole: null,
        identitySessionId: "identity-session-1",

        scopes: ["bid.write"],
      }),
    };
    const app = new Hono();
    app.route("/users", createUserRoutes(container, authenticator));

    const res = await app.request("/users/me/delete", {
      method: "POST",
      headers: {
        authorization: API_AUTHORIZATION,
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }),
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("credential_required");
  });
});
