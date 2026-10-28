import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import { createProductAuthRoutes } from "./auth.js";

const API_AUTHORIZATION = "Bearer test-lax-bid-api-token";

function issuerError(status: number, code: string): IdentityIssuerClientError {
  return new IdentityIssuerClientError("http", code, status, code);
}

/**
 * The email-change flow itself (tokens, emails, the switch) lives in the identity issuer and is
 * tested there. These cases cover what Bid adds: session and step-up gating, the mapping of the
 * issuer's answers to Bid's response codes, and Bid's audit events.
 */
function mountIdentity(options: { authenticated?: boolean } = {}) {
  const identityIssuer = {
    signUpEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    requestMagicLink: vi.fn(),
    stepUpStatus: vi.fn(async () => ({ hasCredential: true, lastPasswordAuthAt: new Date() })),
    startEmailChange: vi.fn(async (_input: { subjectId: string; newEmail: string }) => undefined),
    pendingEmailChange: vi.fn(async (): Promise<string | null> => "next@example.com"),
    cancelEmailChange: vi.fn(async () => undefined),
    confirmEmailChange: vi.fn(async (_input: { token: string }) => ({
      subjectId: "u1",
      completed: false,
      confirmedFor: "old" as "old" | "new",
    })),
  };
  const authAuditPublisher = { publish: vi.fn(async () => {}) };
  const env = { WEB_ORIGIN: "http://localhost:3000", LOG_LEVEL: "error", NODE_ENV: "test" };
  const container = {
    env,
    db: {},
    identityIssuer: identityIssuer as never,
    authenticator: {
      getSessionUser: vi.fn(async () =>
        options.authenticated === false
          ? null
          : {
              id: "u1",
              role: "client" as const,
              staffRoles: [],
              identitySessionId: "identity-session-1",
              scopes: ["bid.write"],
            },
      ),
    },
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    authAuditPublisher,
    redis: null,
    identityRoutes: {
      accountSecurityHttp: new IdentityAccountSecurityHttpApplicationService({
        env: env as never,
        identityIssuer: identityIssuer as never,
        emailService: { enqueue: vi.fn() } as never,
        authAuditPublisher,
        authCredentialReader: { hasCredentialAccount: vi.fn(async () => false) },
      }),
    },
  };
  const app = new Hono().route("/auth", createProductAuthRoutes(container as never));
  return { app, identityIssuer, authAuditPublisher };
}

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: API_AUTHORIZATION },
    body: JSON.stringify(body),
  });

describe("POST /auth/change-email", () => {
  it("hands the change to the issuer, which owns the emails, and records the audit event", async () => {
    const { app, identityIssuer, authAuditPublisher } = mountIdentity();
    const res = await post(app, "/auth/change-email", {
      newEmail: "next@example.com",
      confirmEmail: "next@example.com",
    });

    expect(res.status).toBe(200);
    expect(identityIssuer.startEmailChange).toHaveBeenCalledWith({
      subjectId: "u1",
      newEmail: "next@example.com",
    });
    expect(authAuditPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "auth.email_change_started", actorUserId: "u1" }),
    );
  });

  it.each([
    ["email_taken", 409, "email_change_email_taken"],
    ["same_email", 400, "email_change_same_email"],
    ["subject_not_found", 404, "user_not_found"],
  ] as const)("maps the issuer's %s to HTTP %i", async (issuerCode, status, code) => {
    const { app, identityIssuer, authAuditPublisher } = mountIdentity();
    identityIssuer.startEmailChange.mockRejectedValueOnce(issuerError(409, issuerCode));

    const res = await post(app, "/auth/change-email", {
      newEmail: "next@example.com",
      confirmEmail: "next@example.com",
    });

    expect(res.status).toBe(status);
    expect(((await res.json()) as { code: string }).code).toBe(code);
    expect(authAuditPublisher.publish).not.toHaveBeenCalled();
  });

  it("returns 401 without a session", async () => {
    const { app, identityIssuer } = mountIdentity({ authenticated: false });
    const res = await post(app, "/auth/change-email", {
      newEmail: "next@example.com",
      confirmEmail: "next@example.com",
    });
    expect(res.status).toBe(401);
    expect(identityIssuer.startEmailChange).not.toHaveBeenCalled();
  });
});

describe("POST /auth/confirm-email-change", () => {
  it("returns 400 when the token is missing", async () => {
    const { app, identityIssuer } = mountIdentity();
    const res = await post(app, "/auth/confirm-email-change", {});
    expect(res.status).toBe(400);
    expect(identityIssuer.confirmEmailChange).not.toHaveBeenCalled();
  });

  it("passes the emailed token to the issuer unchanged", async () => {
    const { app, identityIssuer } = mountIdentity();
    await post(app, "/auth/confirm-email-change", { token: "signed.token" });
    expect(identityIssuer.confirmEmailChange).toHaveBeenCalledWith({ token: "signed.token" });
  });

  it.each([
    ["old", "new address"],
    ["new", "current address"],
  ] as const)(
    "tells the person to confirm the other inbox after the %s one",
    async (confirmedFor, expected) => {
      const { app, identityIssuer } = mountIdentity();
      identityIssuer.confirmEmailChange.mockResolvedValueOnce({
        subjectId: "u1",
        completed: false,
        confirmedFor,
      });
      const res = await post(app, "/auth/confirm-email-change", { token: "t" });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { completed: boolean; message: string };
      expect(body.completed).toBe(false);
      expect(body.message).toContain(expected);
    },
  );

  it("reports completion and audits it against the subject the issuer names", async () => {
    const { app, identityIssuer, authAuditPublisher } = mountIdentity();
    identityIssuer.confirmEmailChange.mockResolvedValueOnce({
      subjectId: "u9",
      completed: true,
      confirmedFor: "new",
    });
    const res = await post(app, "/auth/confirm-email-change", { token: "t" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { completed: boolean }).completed).toBe(true);
    expect(authAuditPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "auth.email_change_completed", actorUserId: "u9" }),
    );
  });

  it.each([
    ["stale_flow", 409, "email_change_stale"],
    ["expired", 410, "email_change_expired"],
    ["email_taken", 409, "email_change_email_taken"],
    ["subject_not_found", 404, "user_not_found"],
    ["invalid_token", 400, "email_change_token_invalid"],
  ] as const)("maps the issuer's %s to HTTP %i", async (issuerCode, status, code) => {
    const { app, identityIssuer } = mountIdentity();
    identityIssuer.confirmEmailChange.mockRejectedValueOnce(issuerError(status, issuerCode));
    const res = await post(app, "/auth/confirm-email-change", { token: "t" });
    expect(res.status).toBe(status);
    expect(((await res.json()) as { code: string }).code).toBe(code);
  });
});

describe("DELETE /auth/change-email", () => {
  const remove = (app: Hono) =>
    app.request("/auth/change-email", {
      method: "DELETE",
      headers: { authorization: API_AUTHORIZATION },
    });

  it("returns 401 without a session", async () => {
    const { app } = mountIdentity({ authenticated: false });
    expect((await remove(app)).status).toBe(401);
  });

  it("returns 400 when no change is in progress", async () => {
    const { app, identityIssuer } = mountIdentity();
    identityIssuer.pendingEmailChange.mockResolvedValueOnce(null);
    expect((await remove(app)).status).toBe(400);
    expect(identityIssuer.cancelEmailChange).not.toHaveBeenCalled();
  });

  it("cancels a change in progress", async () => {
    const { app, identityIssuer } = mountIdentity();
    expect((await remove(app)).status).toBe(200);
    expect(identityIssuer.cancelEmailChange).toHaveBeenCalledWith("u1");
  });
});
