import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { SHOP_BASKET_COOKIE_NAME } from "../basket-cookie.js";
import { ShopIdentityReauthRequiredError } from "../errors/shop-identity-reauth.error.js";
import type { ShopSessionRepository } from "../session.js";
import { OIDC_ID_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "../session.js";
import { createTestTokenService } from "../test/token-service.mock.js";
import { registerCommerceRoutes } from "./commerce.routes.js";

const SESSION_ID = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
const ID_TOKEN = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEifQ.signature";
const AUTH_COOKIE = `${SESSION_COOKIE_NAME}=${SESSION_ID}; ${OIDC_ID_TOKEN_COOKIE_NAME}=${ID_TOKEN}`;

function createCommerceApp(
  shopApiFetch: ReturnType<typeof vi.fn>,
  tokenServiceOverrides: Parameters<typeof createTestTokenService>[0] = {},
) {
  const app = new Hono();
  const sessionRepository: ShopSessionRepository = {
    findActive: vi.fn(async () => ({
      id: SESSION_ID,
      subject: "user-1",
      sid: "sid-1",
      oauth: null,
    })),
    createGuestSession: vi.fn(async () => SESSION_ID),
    createPendingOAuth: vi.fn(),
    attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
    authenticate: vi.fn(),
    invalidate: vi.fn(),
    consumeLogoutToken: vi.fn(),
  };
  registerCommerceRoutes(app, {
    env: {
      NODE_ENV: "test",
      PORT: 3010,
      OIDC_ISSUER_URL: "http://localhost:3001",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: "test-bff-token-minimum-32-characters-long",
      OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      SHOP_API_BASE_URL: "http://localhost:3011",
      SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
      DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
      FEDCM_ENABLED: false,
    },
    secureCookies: false,
    sessionRepository,
    tokenService: createTestTokenService({
      resolveIdToken: vi.fn(async () => ID_TOKEN),
      ...tokenServiceOverrides,
    }),
    shopApi: {
      baseUrl: "http://localhost:3011",
      bffToken: "test-bff-token-minimum-32-characters-long",
      tokenEndpoint: "http://localhost:3001/token",
      clientId: "lax-shop-web",
      clientSecret: "test-bff-token-minimum-32-characters-long",
    },
    shopApiFetch,
  });
  return { app, sessionRepository };
}

function createGuestCommerceApp(shopApiFetch: ReturnType<typeof vi.fn>) {
  const app = new Hono();
  const sessionRepository: ShopSessionRepository = {
    findActive: vi.fn(async () => null),
    createGuestSession: vi.fn(async () => SESSION_ID),
    createPendingOAuth: vi.fn(),
    attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
    authenticate: vi.fn(),
    invalidate: vi.fn(),
    consumeLogoutToken: vi.fn(),
  };
  registerCommerceRoutes(app, {
    env: {
      NODE_ENV: "test",
      PORT: 3010,
      OIDC_ISSUER_URL: "http://localhost:3001",
      OIDC_CLIENT_ID: "lax-shop-web",
      OIDC_CLIENT_SECRET: "test-bff-token-minimum-32-characters-long",
      OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
      SHOP_STOREFRONT_URL: "http://localhost:3020",
      SHOP_API_BASE_URL: "http://localhost:3011",
      SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
      DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
      FEDCM_ENABLED: false,
    },
    secureCookies: false,
    sessionRepository,
    tokenService: createTestTokenService({
      resolveIdToken: vi.fn(async () => ID_TOKEN),
    }),
    shopApi: {
      baseUrl: "http://localhost:3011",
      bffToken: "test-bff-token-minimum-32-characters-long",
      tokenEndpoint: "http://localhost:3001/token",
      clientId: "lax-shop-web",
      clientSecret: "test-bff-token-minimum-32-characters-long",
    },
    shopApiFetch,
  });
  return app;
}

describe("commerce routes Set-Cookie", () => {
  it("returns Set-Cookie on guest basket line upsert via c.body proxy", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({
        basketId: "b1",
        expiresAt: new Date().toISOString(),
        merchandiseSubtotalPence: 100,
        lines: [],
      }),
    );
    const app = createGuestCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = csrf.headers.get("set-cookie") ?? "";

    const response = await app.request("/commerce/basket/lines", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: csrfCookie,
        "x-shop-csrf": csrfBody.csrfToken,
      },
      body: JSON.stringify({ artworkSlug: "demo", quantity: 1 }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("shop_basket_token=");
  });

  it("returns 400 when basket line body fails validation", async () => {
    const app = createGuestCommerceApp(vi.fn());
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = csrf.headers.get("set-cookie") ?? "";

    const response = await app.request("/commerce/basket/lines", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        cookie: csrfCookie,
        "x-shop-csrf": csrfBody.csrfToken,
      },
      body: JSON.stringify({ artworkSlug: "", quantity: 0 }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "validation_failed" });
  });
});

describe("commerce artwork interest routes", () => {
  it("returns 401 for guest GET interest", async () => {
    const app = createGuestCommerceApp(vi.fn());
    const getResponse = await app.request("/commerce/artworks/demo/interest");
    expect(getResponse.status).toBe(401);
    expect(await getResponse.json()).toEqual({ error: "sign_in_required" });
  });

  it("returns 403 for guest POST interest without CSRF before auth", async () => {
    const app = createGuestCommerceApp(vi.fn());
    const postResponse = await app.request("/commerce/artworks/demo/interest", { method: "POST" });
    expect(postResponse.status).toBe(403);
    expect(await postResponse.json()).toEqual({ error: "csrf_failed" });
  });

  it("returns 403 for POST interest without CSRF", async () => {
    const { app } = createCommerceApp(vi.fn());
    const response = await app.request("/commerce/artworks/demo/interest", {
      method: "POST",
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "csrf_failed" });
  });

  it("proxies authenticated GET interest with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ subscribed: true }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/artworks/reed-study/interest", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ subscribed: true });
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/artworks/reed-study/interest",
        method: "GET",
        scopes: "shop.read",
      }),
    );
  });

  it("proxies authenticated POST interest with shop.write scope", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ status: "registered" }));
    const { app } = createCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = csrf.headers.get("set-cookie") ?? "";

    const response = await app.request("/commerce/artworks/reed-study/interest", {
      method: "POST",
      headers: {
        cookie: `${AUTH_COOKIE}; ${csrfCookie}`,
        "x-shop-csrf": csrfBody.csrfToken,
      },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/artworks/reed-study/interest",
        method: "POST",
        scopes: "shop.write",
      }),
    );
  });

  it("returns 401 sign_in_required when refresh is rejected", async () => {
    const tokenService = createTestTokenService({
      resolveIdToken: vi.fn(async () => {
        throw new ShopIdentityReauthRequiredError("refresh_rejected");
      }),
      clear: vi.fn(async () => undefined),
    });
    const app = new Hono();
    registerCommerceRoutes(app, {
      env: {
        NODE_ENV: "test",
        PORT: 3010,
        OIDC_ISSUER_URL: "http://localhost:3001",
        OIDC_CLIENT_ID: "lax-shop-web",
        OIDC_CLIENT_SECRET: "test-bff-token-minimum-32-characters-long",
        OIDC_REDIRECT_URI: "http://localhost:3010/auth/callback",
        OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/",
        SHOP_STOREFRONT_URL: "http://localhost:3020",
        SHOP_API_BASE_URL: "http://localhost:3011",
        SHOP_API_BFF_TOKEN: "test-bff-token-minimum-32-characters-long",
        DATABASE_URL_SHOP: "postgres://shop:shop@127.0.0.1:5432/shop",
        FEDCM_ENABLED: false,
      },
      secureCookies: false,
      sessionRepository: {
        findActive: vi.fn(async () => ({
          id: SESSION_ID,
          subject: "user-1",
          sid: "sid-1",
          oauth: null,
        })),
        createGuestSession: vi.fn(),
        createPendingOAuth: vi.fn(),
        attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
        authenticate: vi.fn(),
        invalidate: vi.fn(),
        consumeLogoutToken: vi.fn(),
      },
      tokenService,
      shopApi: {
        baseUrl: "http://localhost:3011",
        bffToken: "test-bff-token-minimum-32-characters-long",
        tokenEndpoint: "http://localhost:3001/token",
        clientId: "lax-shop-web",
        clientSecret: "test-bff-token-minimum-32-characters-long",
      },
      shopApiFetch: vi.fn(),
    });
    const response = await app.request("/commerce/artworks/reed-study/interest", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign_in_required" });
    expect(tokenService.clear).toHaveBeenCalledWith(SESSION_ID);
    expect(response.headers.get("set-cookie")).toContain(`${SESSION_COOKIE_NAME}=; Max-Age=0`);
  });

  it("proxies interest after resolving a rotated id token", async () => {
    const refreshed = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjk5OTk5OTk5OTl9.sig";
    const shopApiFetch = vi.fn(async () => Response.json({ subscribed: false }));
    const { app } = createCommerceApp(shopApiFetch, {
      resolveIdToken: vi.fn(async () => refreshed),
    });
    const response = await app.request("/commerce/artworks/string-study/interest", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ idToken: refreshed }),
    );
  });

  it("wraps malformed upstream shop-api errors", async () => {
    const shopApiFetch = vi.fn(async () => new Response("not-json", { status: 502 }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/artworks/reed-study/interest", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("invalid_upstream");
  });
});

describe("commerce basket merge on sign-in", () => {
  it("preserves guest basket cookie when upstream merge fails", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ code: "shop.basket_conflict", message: "conflict" }, { status: 409 }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const guestToken = "guest-basket-token-value01234567890123456789012";
    const response = await app.request("/commerce/basket/merge-on-sign-in", {
      method: "POST",
      headers: {
        cookie: `${AUTH_COOKIE}; ${SHOP_BASKET_COOKIE_NAME}=${guestToken}; ${csrf.headers.get("set-cookie") ?? ""}`,
        "x-shop-csrf": csrfBody.csrfToken,
      },
    });
    expect(response.status).toBe(409);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rotates basket cookie after successful merge", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ merged: true }));
    const { app } = createCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const guestToken = "guest-basket-token-value01234567890123456789012";
    const response = await app.request("/commerce/basket/merge-on-sign-in", {
      method: "POST",
      headers: {
        cookie: `${AUTH_COOKIE}; ${SHOP_BASKET_COOKIE_NAME}=${guestToken}; ${csrf.headers.get("set-cookie") ?? ""}`,
        "x-shop-csrf": csrfBody.csrfToken,
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(`${SHOP_BASKET_COOKIE_NAME}=`);
  });
});
