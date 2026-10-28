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
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/signed-out",
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
      OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/signed-out",
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

  it("accepts merchandise variant basket line body", async () => {
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
      body: JSON.stringify({
        productVariantId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 1,
      }),
    });

    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/basket/lines",
        body: {
          productVariantId: "550e8400-e29b-41d4-a716-446655440000",
          quantity: 1,
        },
      }),
    );
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

  it("proxies authenticated GET portal sales with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ items: [] }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/sales", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/sales",
        method: "GET",
        scopes: "shop.read",
      }),
    );
  });

  it("proxies authenticated GET seller access with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ editions: false, payouts: true, artist: false }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/seller-access", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/seller-access",
        method: "GET",
        scopes: "shop.read",
      }),
    );
  });

  it("proxies authenticated GET artist artworks with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({
        artist: { artistId: "a1", slug: "artist", displayName: "Artist" },
        items: [],
      }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/artist/artworks", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/artist/artworks",
        method: "GET",
        scopes: "shop.read",
      }),
    );
  });

  it("proxies authenticated GET artist sales with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ artist: null, items: [] }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/artist/sales", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/artist/sales",
        method: "GET",
        scopes: "shop.read",
      }),
    );
  });

  it("proxies authenticated GET sale authority requests with shop.read scope", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ items: [] }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/sale-authority-requests", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/sale-authority-requests",
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

  it("forwards idempotency-key on POST sale authority requests", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ requestId: "req-1", status: "pending" }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf");
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = csrf.headers.get("set-cookie") ?? "";

    const response = await app.request("/commerce/me/sale-authority-requests", {
      method: "POST",
      headers: {
        cookie: `${AUTH_COOKIE}; ${csrfCookie}`,
        "x-shop-csrf": csrfBody.csrfToken,
        "content-type": "application/json",
        "idempotency-key": "idem-key-12345678",
      },
      body: JSON.stringify({ artworkId: "art-1", requestedCount: 2 }),
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/sale-authority-requests",
        method: "POST",
        scopes: "shop.write",
        idempotencyKey: "idem-key-12345678",
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
        OIDC_POST_LOGOUT_REDIRECT_URI: "http://localhost:3020/signed-out",
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

function idTokenWithClaims(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: "user-1", ...claims })}.signature`;
}

async function authedCsrfHeaders(app: Hono) {
  const csrf = await app.request("/commerce/csrf", { headers: { cookie: AUTH_COOKIE } });
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const csrfCookie = (csrf.headers.get("set-cookie") ?? "").split(";")[0];
  return {
    "content-type": "application/json",
    cookie: `${AUTH_COOKIE}; ${csrfCookie}`,
    "x-shop-csrf": csrfToken,
  };
}

const checkoutBody = {
  basketId: "11111111-1111-4111-8111-111111111111",
  fulfilment: "collection",
  idempotencyKey: "idem-key-1234",
  successUrl: "http://localhost:3020/checkout/success",
  cancelUrl: "http://localhost:3020/checkout/cancel",
};

describe("checkout email verification", () => {
  it.each([
    ["/commerce/checkout", checkoutBody],
    ["/commerce/orders/11111111-1111-4111-8111-111111111111/resume-checkout", {}],
  ])("rejects %s for unverified email without calling shop-api", async (path, body) => {
    const shopApiFetch = vi.fn();
    const unverified = idTokenWithClaims({ email_verified: false });
    const { app } = createCommerceApp(shopApiFetch, {
      resolveIdToken: vi.fn(async () => unverified),
    });

    const response = await app.request(path, {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "email_not_verified" });
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("proxies checkout once the email is verified", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ url: "https://stripe.test/pay" }));
    const verified = idTokenWithClaims({ email_verified: true });
    const { app } = createCommerceApp(shopApiFetch, {
      resolveIdToken: vi.fn(async () => verified),
    });

    const response = await app.request("/commerce/checkout", {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify(checkoutBody),
    });

    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledOnce();
  });
});

describe("commerce favorites proxy routes", () => {
  async function csrfHeaders(app: Hono) {
    const csrf = await app.request("/commerce/csrf");
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = (csrf.headers.get("set-cookie") ?? "").split(";")[0];
    return { cookie: `${AUTH_COOKIE}; ${csrfCookie}`, "x-shop-csrf": csrfToken };
  }

  it.each([
    ["/commerce/me/favorites/artworks", "/v1/me/favorites/artworks"],
    ["/commerce/me/favorites/artists", "/v1/me/favorites/artists"],
  ])("proxies GET %s with shop.read scope", async (route, upstreamPath) => {
    const shopApiFetch = vi.fn(async () => Response.json({ items: [] }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(route, { headers: { cookie: AUTH_COOKIE } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: upstreamPath, method: "GET", scopes: "shop.read" }),
    );
  });

  it("returns 401 for guest GET favorites without calling shop-api", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/favorites/artworks");
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "sign_in_required" });
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["PUT", "/commerce/me/favorites/artworks/reed-study"],
    ["DELETE", "/commerce/me/favorites/artworks/reed-study"],
    ["PUT", "/commerce/me/favorites/artists/ada-artist"],
    ["DELETE", "/commerce/me/favorites/artists/ada-artist"],
  ])("rejects %s %s without CSRF", async (method, route) => {
    const shopApiFetch = vi.fn();
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(route, { method, headers: { cookie: AUTH_COOKIE } });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "csrf_failed" });
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("rejects favorites mutations from a foreign Origin even with a valid CSRF pair", async () => {
    const shopApiFetch = vi.fn();
    const { app } = createCommerceApp(shopApiFetch);
    const headers = await csrfHeaders(app);
    const response = await app.request("/commerce/me/favorites/artworks/reed-study", {
      method: "PUT",
      headers: { ...headers, origin: "https://evil.example" },
    });
    expect(response.status).toBe(403);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["PUT", "/commerce/me/favorites/artworks/reed study", "/v1/me/favorites/artworks/reed%20study"],
    [
      "DELETE",
      "/commerce/me/favorites/artworks/reed-study",
      "/v1/me/favorites/artworks/reed-study",
    ],
    ["PUT", "/commerce/me/favorites/artists/ada-artist", "/v1/me/favorites/artists/ada-artist"],
    ["DELETE", "/commerce/me/favorites/artists/ada-artist", "/v1/me/favorites/artists/ada-artist"],
  ])("proxies %s %s with shop.write scope", async (method, route, upstreamPath) => {
    const shopApiFetch = vi.fn(async () => Response.json({ status: "saved" }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(route, { method, headers: await csrfHeaders(app) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "saved" });
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: upstreamPath, method, scopes: "shop.write" }),
    );
  });

  it("passes upstream 404 through as a commerce_upstream_failed envelope", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ code: "shop.not_found", message: "Artwork not found" }, { status: 404 }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/favorites/artworks/missing", {
      method: "PUT",
      headers: await csrfHeaders(app),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "commerce_upstream_failed",
      code: "shop.not_found",
      message: "Artwork not found",
    });
  });

  it("passes upstream feature_disabled 404 through on GET", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ code: "shop.feature_disabled", message: "Disabled" }, { status: 404 }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/favorites/artists", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "shop.feature_disabled" });
  });
});

describe("commerce enquiry routes", () => {
  const GUEST = { name: "Grace Hopper", email: "grace@example.com" };
  const loopbackPeer = { incoming: { socket: { remoteAddress: "127.0.0.1" } } };

  async function csrfHeaders(app: Hono, extra: Record<string, string> = {}) {
    const csrf = await app.request("/commerce/csrf");
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const cookie = csrf.headers.get("set-cookie") ?? "";
    return {
      "content-type": "application/json",
      "x-shop-csrf": csrfToken,
      ...extra,
      cookie: [extra.cookie, cookie].filter(Boolean).join("; "),
    };
  }

  it("sends a guest artwork enquiry on the BFF token with the browser address", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ status: "registered" }));
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request(
      "/commerce/artworks/reed-study/interest",
      {
        method: "POST",
        headers: await csrfHeaders(app, { "x-forwarded-for": "203.0.113.9" }),
        body: JSON.stringify({ intent: "enquiry", message: "Is it framed?", ...GUEST }),
      },
      loopbackPeer,
    );
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/artworks/reed-study/interest",
        method: "POST",
        scopes: "shop.write",
        idToken: null,
        clientIp: "203.0.113.9",
        body: { intent: "enquiry", message: "Is it framed?", ...GUEST },
      }),
    );
  });

  it("sends a guest edition alert with only an email address", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ status: "registered" }));
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request(
      "/commerce/artworks/reed-study/interest",
      {
        method: "POST",
        headers: await csrfHeaders(app, { "x-forwarded-for": "203.0.113.9" }),
        body: JSON.stringify({ intent: "notify_me", email: "grace@example.com" }),
      },
      loopbackPeer,
    );
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/artworks/reed-study/interest",
        idToken: null,
        clientIp: "203.0.113.9",
        body: { intent: "notify_me", email: "grace@example.com" },
      }),
    );
  });

  it("needs an email address for a guest edition alert", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/artworks/reed-study/interest", {
      method: "POST",
      headers: await csrfHeaders(app),
      body: JSON.stringify({ intent: "notify_me" }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "validation_failed" });
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("keeps a signed-in shopper's alerts behind sign-in", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const list = await app.request("/commerce/me/alerts");
    expect(list.status).toBe(401);
    const stop = await app.request("/commerce/me/alerts/artworks/reed-study", {
      method: "DELETE",
      headers: await csrfHeaders(app),
    });
    expect(stop.status).toBe(401);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["without name and email", { intent: "enquiry", message: "Hello" }],
    ["with an invalid email", { intent: "enquiry", message: "Hello", ...GUEST, email: "nope" }],
  ])("rejects a guest artwork enquiry %s", async (_label, body) => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/artworks/reed-study/interest", {
      method: "POST",
      headers: await csrfHeaders(app),
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "validation_failed" });
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("sends a guest general enquiry", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ enquiryId: "e1" }, { status: 201 }));
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/general-enquiries", {
      method: "POST",
      headers: await csrfHeaders(app),
      body: JSON.stringify({ topic: "selling", message: "I have a painting", ...GUEST }),
    });
    expect(response.status).toBe(201);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/me/general-enquiries",
        idToken: null,
        body: { topic: "selling", message: "I have a painting", ...GUEST },
      }),
    );
  });

  it("requires CSRF for guest enquiries", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/general-enquiries", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ topic: "general", message: "Hello", ...GUEST }),
    });
    expect(response.status).toBe(403);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("keeps the account linkage for a signed-in general enquiry, with name and email optional", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ enquiryId: "e1" }, { status: 201 }));
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/general-enquiries", {
      method: "POST",
      headers: await csrfHeaders(app, { cookie: AUTH_COOKIE }),
      body: JSON.stringify({ topic: "general", message: "Hello" }),
    });
    expect(response.status).toBe(201);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        idToken: ID_TOKEN,
        body: { topic: "general", message: "Hello" },
      }),
    );
    expect(shopApiFetch).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ clientIp: expect.anything() }),
    );
  });

  it("passes a filled honeypot through for the API to drop", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ enquiryId: "e1" }, { status: 201 }));
    const app = createGuestCommerceApp(shopApiFetch);
    await app.request("/commerce/me/general-enquiries", {
      method: "POST",
      headers: await csrfHeaders(app),
      body: JSON.stringify({
        topic: "general",
        message: "Hello",
        website: "https://spam.example",
        ...GUEST,
      }),
    });
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        body: expect.objectContaining({ website: "https://spam.example" }),
      }),
    );
  });
});

describe("commerce order routes", () => {
  const ORDER_ID = "550e8400-e29b-41d4-a716-846655440001";

  it("passes the invoice PDF through with its file name and no caching", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    const shopApiFetch = vi.fn(
      async () =>
        new Response(pdf, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": 'attachment; filename="LAX-S-10482-invoice.pdf"',
            "x-upstream-only": "1",
          },
        }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(`/commerce/orders/${ORDER_ID}/invoice`, {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("LAX-S-10482-invoice.pdf");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-upstream-only")).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdf);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: `/v1/orders/${ORDER_ID}/invoice`, scopes: "shop.read" }),
    );
  });

  it("answers a missing invoice as JSON", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ code: "shop.not_found", message: "Invoice not found" }, { status: 404 }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(`/commerce/orders/${ORDER_ID}/invoice`, {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "shop.not_found" });
  });

  it("checks a problem report before sending it on", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ reportId: "550e8400-e29b-41d4-a716-846655440099" }, { status: 201 }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const csrf = await app.request("/commerce/csrf", { headers: { cookie: AUTH_COOKIE } });
    const csrfBody = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = csrf.headers.get("set-cookie")?.split(";")[0] ?? "";
    const headers = {
      "content-type": "application/json",
      cookie: `${AUTH_COOKIE}; ${csrfCookie}`,
      "x-shop-csrf": csrfBody.csrfToken,
    };

    const invalid = await app.request(`/commerce/orders/${ORDER_ID}/problem-reports`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "lost", details: "" }),
    });
    expect(invalid.status).toBe(400);
    expect(shopApiFetch).not.toHaveBeenCalled();

    const sent = await app.request(`/commerce/orders/${ORDER_ID}/problem-reports`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reason: "damaged", details: "The corner is creased." }),
    });
    expect(sent.status).toBe(201);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "POST",
        path: `/v1/orders/${ORDER_ID}/problem-reports`,
        body: { reason: "damaged", details: "The corner is creased." },
      }),
    );
  });
});

describe("commerce artist application routes", () => {
  const ID = "0b6a7c1e-2f3d-4a5b-8c9d-0e1f2a3b4c5d";

  it("reads the signed-in artist's application", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({ application: null, next: "start", availableFrom: null }),
    );
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/artist-application", {
      headers: { cookie: AUTH_COOKIE },
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "GET",
        path: "/v1/me/artist-application",
        scopes: "shop.read",
      }),
    );
  });

  it("asks a visitor without a session to sign in", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/artist-application");
    expect(response.status).toBe(401);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("saves a draft with CSRF and passes the body through", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ id: ID }));
    const { app } = createCommerceApp(shopApiFetch);
    const body = { expectedVersion: 2, artistName: "Ada Moreno" };
    const response = await app.request(`/commerce/me/artist-application/${ID}`, {
      method: "PUT",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: "PUT",
        path: `/v1/me/artist-application/${ID}`,
        scopes: "shop.write",
        body,
      }),
    );
  });

  it.each(["submit", "images/presign", "images/confirm"])("forwards %s", async (suffix) => {
    const shopApiFetch = vi.fn(async () => Response.json({ ok: true }));
    const { app } = createCommerceApp(shopApiFetch);
    await app.request(`/commerce/me/artist-application/${ID}/${suffix}`, {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: `/v1/me/artist-application/${ID}/${suffix}` }),
    );
  });

  it("refuses a write without CSRF", async () => {
    const shopApiFetch = vi.fn();
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request(`/commerce/me/artist-application/${ID}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: AUTH_COOKIE },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    expect(response.status).toBe(403);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("never forwards an id that is not a UUID", async () => {
    const shopApiFetch = vi.fn();
    const { app } = createCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/me/artist-application/not-an-id/submit", {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: "{}",
    });
    expect(response.status).toBe(404);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });
});
