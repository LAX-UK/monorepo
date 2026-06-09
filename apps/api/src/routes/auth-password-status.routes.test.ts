import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createAuthRoutes } from "./auth.js";

function buildFakeAuthDb(hasCredential: boolean) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (hasCredential ? [{ id: "cred-1" }] : [])),
        })),
      })),
    })),
  };
}

function mountAuth(opts: {
  authDb: object;
  getSessionUser?: IAuthenticator["getSessionUser"];
}) {
  const authenticator: IAuthenticator = {
    getSessionUser:
      opts.getSessionUser ?? vi.fn(async () => ({ id: "u1", role: "client" as const })),
  };
  const container = {
    env: { WEB_ORIGIN: "http://localhost:3000" },
    authDb: opts.authDb,
    redis: null,
    authenticator,
    userSuspensionChecker: { isSuspended: vi.fn(async () => false) },
    auth: { api: { getSession: vi.fn(async () => null) } },
    authAuditPublisher: { publish: vi.fn(async () => {}) },
    db: {},
    emailService: { enqueue: vi.fn() },
    userService: {},
  };
  const app = new Hono().route("/auth", createAuthRoutes(container as never));
  return { app };
}

describe("GET /auth/password-status", () => {
  it("returns 401 without a session", async () => {
    const { app } = mountAuth({
      authDb: buildFakeAuthDb(false),
      getSessionUser: vi.fn(async () => null),
    });
    const res = await app.request("/auth/password-status");
    expect(res.status).toBe(401);
  });

  it("returns hasPassword true when a credential account exists", async () => {
    const { app } = mountAuth({ authDb: buildFakeAuthDb(true) });
    const res = await app.request("/auth/password-status", {
      headers: { cookie: "better-auth.session_token=test" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hasPassword: true } });
  });

  it("returns hasPassword false when no credential account exists", async () => {
    const { app } = mountAuth({ authDb: buildFakeAuthDb(false) });
    const res = await app.request("/auth/password-status", {
      headers: { cookie: "better-auth.session_token=test" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { hasPassword: false } });
  });
});
