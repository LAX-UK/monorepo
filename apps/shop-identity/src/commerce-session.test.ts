import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  resolveAuthenticatedCommerceContext,
  resolveGuestCommerceContext,
} from "./commerce-session.js";
import { ShopIdentityReauthRequiredError } from "./errors/shop-identity-reauth.error.js";
import { OIDC_ID_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "./session.js";
import type { ShopSessionRepository } from "./session.js";
import { createTestTokenService } from "./test/token-service.mock.js";

const SESSION_ID = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
const ID_TOKEN = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEifQ.signature";

function sessionRepository(overrides: Partial<ShopSessionRepository> = {}): ShopSessionRepository {
  return {
    findActive: vi.fn(async () => null),
    createGuestSession: vi.fn(async () => "new-guest-session-id012345678901234567890"),
    createPendingOAuth: vi.fn(),
    attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
    authenticate: vi.fn(),
    invalidate: vi.fn(),
    consumeLogoutToken: vi.fn(),
    ...overrides,
  };
}

describe("commerce session boundaries", () => {
  it("creates a guest session when the cookie session is inactive", async () => {
    const findActive = vi.fn(async () => null);
    const createGuestSession = vi.fn(async () => "new-guest-session-id012345678901234567890");
    const repo = sessionRepository({ findActive, createGuestSession });
    const app = new Hono();
    app.get("/guest", async (c) => {
      const ctx = await resolveGuestCommerceContext(c, {
        sessionRepository: repo,
        secureCookies: false,
      });
      return c.json(ctx);
    });

    const response = await app.request("/guest", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}` },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { kind: string; sessionId: string };
    expect(body.kind).toBe("guest");
    expect(body.sessionId).toBe("new-guest-session-id012345678901234567890");
    expect(findActive).toHaveBeenCalledWith(SESSION_ID);
    expect(createGuestSession).toHaveBeenCalledOnce();
  });

  it("rejects authenticated commerce when tokens cannot be resolved", async () => {
    const tokenService = createTestTokenService({
      resolveIdToken: vi.fn(async () => {
        throw new ShopIdentityReauthRequiredError("no_refresh_token");
      }),
    });
    const repo = sessionRepository({
      findActive: vi.fn(async () => ({
        id: SESSION_ID,
        subject: "user-1",
        sid: "sid-1",
        oauth: null,
      })),
    });
    const app = new Hono();
    app.get("/auth", async (c) => {
      try {
        const ctx = await resolveAuthenticatedCommerceContext(c, {
          sessionRepository: repo,
          tokenService,
        });
        return c.json({ ok: ctx !== null, subject: ctx?.subject ?? null });
      } catch {
        return c.json({ ok: false, subject: null }, 401);
      }
    });

    const response = await app.request("/auth", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}` },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, subject: null });
  });

  it("accepts authenticated commerce when the token service resolves an id token", async () => {
    const tokenService = createTestTokenService({
      resolveIdToken: vi.fn(async () => ID_TOKEN),
    });
    const repo = sessionRepository({
      findActive: vi.fn(async () => ({
        id: SESSION_ID,
        subject: "user-1",
        sid: "sid-1",
        oauth: null,
      })),
    });
    const app = new Hono();
    app.get("/auth", async (c) => {
      const ctx = await resolveAuthenticatedCommerceContext(c, {
        sessionRepository: repo,
        tokenService,
      });
      return c.json({
        ok: ctx !== null,
        subject: ctx?.subject ?? null,
        idToken: ctx?.idToken ?? null,
      });
    });

    const response = await app.request("/auth", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${SESSION_ID}; ${OIDC_ID_TOKEN_COOKIE_NAME}=${ID_TOKEN}`,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, subject: "user-1", idToken: ID_TOKEN });
  });
});
