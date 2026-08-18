import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IdentityAccountSecurityHttpApplicationService } from "../services/identity/identity-account-security-http-application.service.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createProductAuthRoutes } from "./auth.js";

function mountAuth(opts: {
  hasCredential?: boolean;
  getSessionUser?: IAuthenticator["getSessionUser"];
}) {
  const authenticator: IAuthenticator = {
    getSessionUser:
      opts.getSessionUser ??
      vi.fn(async () => ({ id: "u1", role: "client" as const, scopes: ["bid.read"] })),
  };
  const authCredentialReader = {
    hasCredentialAccount: vi.fn(async () => opts.hasCredential ?? false),
  };
  const container = {
    env: { WEB_ORIGIN: "http://localhost:3000" },
    redis: null,
    authenticator,
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    identityRoutes: {
      accountSecurityHttp: new IdentityAccountSecurityHttpApplicationService({
        env: { WEB_ORIGIN: "http://localhost:3000" } as never,
        identityIssuer: {
          signUpEmail: vi.fn(),
          sendVerificationEmail: vi.fn(),
          requestPasswordReset: vi.fn(),
          requestMagicLink: vi.fn(),
        } as never,
        userService: {} as never,
        emailService: {} as never,
        authAuditPublisher: { publish: vi.fn(async () => {}) },
        authCredentialReader,
      }),
    },
  };
  const app = new Hono().route("/auth", createProductAuthRoutes(container as never));
  return { app };
}

describe("GET /auth/password-status", () => {
  it("returns 401 without a session", async () => {
    const { app } = mountAuth({
      hasCredential: false,
      getSessionUser: vi.fn(async () => null),
    });
    const res = await app.request("/auth/password-status");
    expect(res.status).toBe(401);
  });

  it("returns hasPassword true when a credential account exists", async () => {
    const { app } = mountAuth({ hasCredential: true });
    const res = await app.request("/auth/password-status", {
      headers: { cookie: "better-auth.session_token=test" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hasPassword: true } });
  });

  it("returns hasPassword false when no credential account exists", async () => {
    const { app } = mountAuth({ hasCredential: false });
    const res = await app.request("/auth/password-status", {
      headers: { cookie: "better-auth.session_token=test" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hasPassword: false } });
  });
});
