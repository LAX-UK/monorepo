import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import type { CompleteOAuthCallbackResult } from "../application/complete-oauth-callback.handler.js";
import type { OidcDiscovery } from "../oidc.js";
import {
  OIDC_ID_TOKEN_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SHOP_TOKEN_UPGRADE_COOKIE_NAME,
} from "../session.js";
import { createTestTokenService } from "../test/token-service.mock.js";
import { registerOAuthRoutes } from "./oauth.routes.js";

function createRoute(callbackResult: CompleteOAuthCallbackResult = { kind: "session_expired" }) {
  const app = new Hono();
  const invalidate = vi.fn(async () => undefined);
  registerOAuthRoutes(app, {
    env: {
      NODE_ENV: "test",
      PORT: 3010,
      OIDC_ISSUER_URL: "https://identity.example",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: "a-secret-longer-than-thirty-two-characters",
      OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      SHOP_API_BASE_URL: "http://localhost:3011",
      SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
      DATABASE_URL_SHOP: "postgres://shop:test@localhost/shop",
    },
    discovery: {
      authorization_endpoint: "https://identity.example/authorize",
      end_session_endpoint: "https://identity.example/logout",
    } as unknown as OidcDiscovery,
    secureCookies: false,
    sessionRepository: {
      findActive: vi.fn(async () => null),
      createPendingOAuth: vi.fn(async () => "pending-session"),
      attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
      createGuestSession: vi.fn(async () => "guest-session-id01234567890123456789012"),
      authenticate: vi.fn(async () => "guest-session-id01234567890123456789012"),
      invalidate,
      consumeLogoutToken: vi.fn(async () => "consumed" as const),
    },
    tokenService: createTestTokenService(),
    completeOAuthCallback: vi.fn(async (): Promise<CompleteOAuthCallbackResult> => callbackResult),
  });
  return { app, invalidate };
}

describe("OAuth routes", () => {
  it("maps callback outcomes to fixed storefront redirects", async () => {
    const { app } = createRoute();
    const response = await app.request("/auth/callback?state=state&code=code");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3020/session-expired");
  });

  it.each([
    {
      outcome: { kind: "error", code: "token_exchange_failed" } as const,
      location: "http://localhost:3020/auth/callback?error=token_exchange_failed",
    },
    {
      outcome: { kind: "disabled" } as const,
      location: "http://localhost:3020/account/disabled",
    },
  ])("maps $outcome.kind without exposing an arbitrary redirect", async ({ outcome, location }) => {
    const { app } = createRoute(outcome);
    const response = await app.request("/auth/callback?state=state&code=code", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=pending-session` },
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(location);
    if (outcome.kind === "disabled") {
      expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    }
  });

  it("persists tokens server-side for authenticated callbacks", async () => {
    const tokenService = createTestTokenService();
    const app = new Hono();
    registerOAuthRoutes(app, {
      env: {
        NODE_ENV: "test",
        PORT: 3010,
        OIDC_ISSUER_URL: "https://identity.example",
        OIDC_CLIENT_ID: "lax-shop-web",
        OIDC_CLIENT_SECRET: "a-secret-longer-than-thirty-two-characters",
        OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
        SHOP_STOREFRONT_URL: "http://localhost:3020",
        SHOP_API_BASE_URL: "http://localhost:3011",
        SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
        DATABASE_URL_SHOP: "postgres://shop:test@localhost/shop",
      },
      discovery: {
        authorization_endpoint: "https://identity.example/authorize",
        end_session_endpoint: "https://identity.example/logout",
      } as unknown as import("../oidc.js").OidcDiscovery,
      secureCookies: false,
      sessionRepository: {
        findActive: vi.fn(async () => null),
        createPendingOAuth: vi.fn(async () => "pending-session"),
        attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
        createGuestSession: vi.fn(async () => "guest-session-id01234567890123456789012"),
        authenticate: vi.fn(async () => "guest-session-id01234567890123456789012"),
        invalidate: vi.fn(),
        consumeLogoutToken: vi.fn(async () => "consumed" as const),
      },
      tokenService,
      completeOAuthCallback: vi.fn(
        async (): Promise<CompleteOAuthCallbackResult> => ({
          kind: "authenticated",
          idToken: "header.payload.signature",
          refreshToken: "refresh-token-value",
          sessionId: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg",
        }),
      ),
    });
    const response = await app.request("/auth/callback?state=state&code=code");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3020/account");
    expect(tokenService.persist).toHaveBeenCalled();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).not.toMatch(new RegExp(`${OIDC_ID_TOKEN_COOKIE_NAME}=[^;]+`));
    expect(setCookie).toContain(`${OIDC_ID_TOKEN_COOKIE_NAME}=; Max-Age=0`);
  });

  it("starts silent upgrade with prompt=none for authenticated sessions", async () => {
    const sessionId = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
    const attachPendingOAuthToAuthenticatedSession = vi.fn(async () => true);
    const app = new Hono();
    registerOAuthRoutes(app, {
      env: {
        NODE_ENV: "test",
        PORT: 3010,
        OIDC_ISSUER_URL: "https://identity.example",
        OIDC_CLIENT_ID: "lax-shop-web",
        OIDC_CLIENT_SECRET: "a-secret-longer-than-thirty-two-characters",
        OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
        SHOP_STOREFRONT_URL: "http://localhost:3020",
        SHOP_API_BASE_URL: "http://localhost:3011",
        SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
        DATABASE_URL_SHOP: "postgres://shop:test@localhost/shop",
      },
      discovery: {
        authorization_endpoint: "https://identity.example/authorize",
        end_session_endpoint: "https://identity.example/logout",
      } as unknown as OidcDiscovery,
      secureCookies: false,
      sessionRepository: {
        findActive: vi.fn(async () => ({
          id: sessionId,
          subject: "sub-1",
          sid: "sid-1",
          oauth: null,
        })),
        createPendingOAuth: vi.fn(),
        attachPendingOAuthToAuthenticatedSession,
        createGuestSession: vi.fn(),
        authenticate: vi.fn(),
        invalidate: vi.fn(),
        consumeLogoutToken: vi.fn(async () => "consumed" as const),
      },
      tokenService: createTestTokenService(),
      completeOAuthCallback: vi.fn(),
    });
    const response = await app.request("/auth/upgrade", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}`,
      },
    });
    expect(attachPendingOAuthToAuthenticatedSession).toHaveBeenCalled();
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("prompt")).toBe("none");
    expect(location.searchParams.get("scope")).toContain("offline_access");
    expect(response.headers.get("set-cookie")).toContain(`${SHOP_TOKEN_UPGRADE_COOKIE_NAME}=`);
  });

  it("blocks a second upgrade attempt while the one-shot cookie is present", async () => {
    const sessionId = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
    const { app } = createRoute();
    const response = await app.request("/auth/upgrade", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${sessionId}; ${SHOP_TOKEN_UPGRADE_COOKIE_NAME}=1`,
      },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3020/login");
  });

  it("clears session on login_required upgrade callback without looping", async () => {
    const tokenService = createTestTokenService();
    const app = new Hono();
    registerOAuthRoutes(app, {
      env: {
        NODE_ENV: "test",
        PORT: 3010,
        OIDC_ISSUER_URL: "https://identity.example",
        OIDC_CLIENT_ID: "lax-shop-web",
        OIDC_CLIENT_SECRET: "a-secret-longer-than-thirty-two-characters",
        OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
        SHOP_STOREFRONT_URL: "http://localhost:3020",
        SHOP_API_BASE_URL: "http://localhost:3011",
        SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
        DATABASE_URL_SHOP: "postgres://shop:test@localhost/shop",
      },
      discovery: {
        authorization_endpoint: "https://identity.example/authorize",
        end_session_endpoint: "https://identity.example/logout",
      } as unknown as OidcDiscovery,
      secureCookies: false,
      sessionRepository: {
        findActive: vi.fn(async () => ({
          id: "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg",
          subject: "sub-1",
          sid: "sid-1",
          oauth: null,
        })),
        createPendingOAuth: vi.fn(),
        attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
        createGuestSession: vi.fn(),
        authenticate: vi.fn(),
        invalidate: vi.fn(),
        consumeLogoutToken: vi.fn(async () => "consumed" as const),
      },
      tokenService,
      completeOAuthCallback: vi.fn(),
    });
    const response = await app.request("/auth/callback?error=login_required&state=state", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg`,
      },
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3020/login");
    expect(tokenService.clear).toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=; Max-Age=0`);
  });

  it("starts confidential-client authorization with PKCE S256 on login and register", async () => {
    for (const path of ["/login", "/register"] as const) {
      const { app } = createRoute();
      const response = await app.request(path);
      expect(response.status).toBe(302);
      const location = new URL(response.headers.get("location") ?? "");
      expect(location.pathname).toBe("/authorize");
      expect(location.searchParams.get("client_id")).toBe("lax-shop-web");
      expect(location.searchParams.get("response_type")).toBe("code");
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      expect(location.searchParams.get("code_challenge")).toBeTruthy();
      expect(location.searchParams.get("state")).toBeTruthy();
      expect(location.searchParams.get("nonce")).toBeTruthy();
      expect(location.searchParams.get("scope")).toContain("offline_access");
      expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(response.headers.get("set-cookie")?.toLowerCase()).toContain("httponly");
    }
  });

  it("invalidates the local session and redirects logout through the provider", async () => {
    const { app, invalidate } = createRoute();
    const response = await app.request("/logout", {
      method: "POST",
      headers: { Origin: "http://localhost:3020" },
    });

    expect(response.status).toBe(303);
    expect(invalidate).toHaveBeenCalledWith(null);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.origin).toBe("https://identity.example");
    expect(location.pathname).toBe("/logout");
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3020/");
  });

  it("rejects logout when the storefront origin does not match", async () => {
    const { app, invalidate } = createRoute();
    const response = await app.request("/logout", {
      method: "POST",
      headers: { Origin: "https://evil.example" },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "csrf_failed" });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
