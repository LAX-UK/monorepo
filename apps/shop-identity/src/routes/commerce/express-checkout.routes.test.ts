import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { SHOP_BASKET_COOKIE_NAME } from "../../basket-cookie.js";
import type { ShopSessionRepository } from "../../session.js";
import { OIDC_ID_TOKEN_COOKIE_NAME, SESSION_COOKIE_NAME } from "../../session.js";
import { createTestTokenService } from "../../test/token-service.mock.js";
import { registerCommerceRoutes } from "../commerce.routes.js";

// Its own file: the commerce rate limit is per process and the other route tests use it up.
const SESSION_ID = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEfg";
const AUTH_COOKIE_SESSION = `${SESSION_COOKIE_NAME}=${SESSION_ID}`;

function idTokenWithClaims(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: "user-1", ...claims })}.signature`;
}

function createApp(
  shopApiFetch: ReturnType<typeof vi.fn>,
  options: { signedIn: boolean; idToken?: string },
) {
  const app = new Hono();
  const sessionRepository: ShopSessionRepository = {
    findActive: vi.fn(async () =>
      options.signedIn ? { id: SESSION_ID, subject: "user-1", sid: "sid-1", oauth: null } : null,
    ),
    createGuestSession: vi.fn(async () => SESSION_ID),
    createPendingOAuth: vi.fn(),
    attachPendingOAuthToAuthenticatedSession: vi.fn(async () => true),
    authenticate: vi.fn(),
    invalidate: vi.fn(),
    consumeLogoutToken: vi.fn(),
  };
  const idToken = options.idToken ?? idTokenWithClaims({ email_verified: true });
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
    tokenService: createTestTokenService({ resolveIdToken: vi.fn(async () => idToken) }),
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

function createCommerceApp(shopApiFetch: ReturnType<typeof vi.fn>, emailVerified: boolean) {
  return {
    app: createApp(shopApiFetch, {
      signedIn: true,
      idToken: idTokenWithClaims({ email_verified: emailVerified }),
    }),
  };
}

function createGuestCommerceApp(shopApiFetch: ReturnType<typeof vi.fn>) {
  return createApp(shopApiFetch, { signedIn: false });
}

async function authedCsrfHeaders(app: Hono) {
  const csrf = await app.request("/commerce/csrf", { headers: { cookie: AUTH_COOKIE_SESSION } });
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const csrfCookie = (csrf.headers.get("set-cookie") ?? "").split(";")[0];
  return {
    "content-type": "application/json",
    cookie: `${AUTH_COOKIE_SESSION}; ${OIDC_ID_TOKEN_COOKIE_NAME}=x; ${csrfCookie}`,
    "x-shop-csrf": csrfToken,
  };
}

describe("express checkout routes (GAP-49)", () => {
  const BASKET_ID = "11111111-1111-4111-8111-111111111111";
  const SESSION = "cs_test_a1B2c3D4e5";
  const ORDER_ID = "22222222-2222-4222-8222-222222222222";
  const ORDER_TOKEN = "A".repeat(43);
  const confirmBody = {
    basketId: BASKET_ID,
    sessionId: SESSION,
    shippingRateId: "uk_insured_delivery",
    name: "Grace Hopper",
    phone: "+44 20 7946 0000",
    shippingAddress: {
      recipientName: "Grace Hopper",
      line1: "1 New Cavendish Street",
      city: "London",
      postcode: "W1G 8UR",
      country: "GB",
    },
  };

  async function guestHeaders(app: Hono) {
    const csrf = await app.request("/commerce/csrf");
    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
    const csrfCookie = (csrf.headers.get("set-cookie") ?? "").split(";")[0];
    return {
      "content-type": "application/json",
      "x-shop-csrf": csrfToken,
      cookie: `${SHOP_BASKET_COOKIE_NAME}=basket-token-1; ${csrfCookie}`,
    };
  }

  it.each([
    ["/commerce/express-checkout", { basketId: BASKET_ID }, "/v1/orders/express-checkout"],
    [
      "/commerce/express-checkout/shipping-address",
      { basketId: BASKET_ID, sessionId: SESSION, address: { country: "GB" } },
      "/v1/orders/express-checkout/shipping-address",
    ],
    ["/commerce/express-checkout/confirm", confirmBody, "/v1/orders/express-checkout/confirm"],
  ])("proxies %s for a verified shopper", async (path, body, upstream) => {
    const shopApiFetch = vi.fn(async () => Response.json({ ok: true }));
    const { app } = createCommerceApp(shopApiFetch, true);
    const response = await app.request(path, {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ path: upstream, scopes: "shop.write", body }),
    );
  });

  it("refuses an unverified email and a malformed body without calling shop-api", async () => {
    const shopApiFetch = vi.fn();
    const { app } = createCommerceApp(shopApiFetch, false);
    const unverified = await app.request("/commerce/express-checkout", {
      method: "POST",
      headers: await authedCsrfHeaders(app),
      body: JSON.stringify({ basketId: BASKET_ID }),
    });
    expect(unverified.status).toBe(403);

    const verified = createCommerceApp(shopApiFetch, true).app;
    const malformed = await verified.request("/commerce/express-checkout/confirm", {
      method: "POST",
      headers: await authedCsrfHeaders(verified),
      body: JSON.stringify({ ...confirmBody, sessionId: "pi_not_a_session" }),
    });
    expect(malformed.status).toBe(400);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("refuses without the CSRF token", async () => {
    const shopApiFetch = vi.fn();
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/guest-checkout/express-checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ basketId: BASKET_ID }),
    });
    expect(response.status).toBe(403);
    expect(shopApiFetch).not.toHaveBeenCalled();
  });

  it("starts a guest session as the storefront with the basket token", async () => {
    const shopApiFetch = vi.fn(async () => Response.json({ sessionId: SESSION }));
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/guest-checkout/express-checkout", {
      method: "POST",
      headers: await guestHeaders(app),
      body: JSON.stringify({ basketId: BASKET_ID }),
    });
    expect(response.status).toBe(200);
    expect(shopApiFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        path: "/v1/guest-checkout/express-checkout",
        idToken: null,
        basketToken: "basket-token-1",
      }),
    );
  });

  it("keeps the guest order token in a cookie, never in the body", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json({
        orderId: ORDER_ID,
        returnUrl: `/checkout/confirmation?orderId=${ORDER_ID}`,
        expiresAt: "2026-11-17T12:30:00.000Z",
        orderAccessToken: ORDER_TOKEN,
        orderAccessExpiresAt: "2026-12-17T12:00:00.000Z",
      }),
    );
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/guest-checkout/express-checkout/confirm", {
      method: "POST",
      headers: await guestHeaders(app),
      body: JSON.stringify({ ...confirmBody, email: "grace@example.com" }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      orderId: ORDER_ID,
      returnUrl: `/checkout/confirmation?orderId=${ORDER_ID}`,
      expiresAt: "2026-11-17T12:30:00.000Z",
    });
    expect(response.headers.get("set-cookie")).toContain(`shop_guest_order=${ORDER_TOKEN}`);
  });

  it("passes shop-api's sold-out refusal through as it is", async () => {
    const shopApiFetch = vi.fn(async () =>
      Response.json(
        { code: "shop.out_of_stock", message: "This print has just sold out" },
        { status: 409 },
      ),
    );
    const app = createGuestCommerceApp(shopApiFetch);
    const response = await app.request("/commerce/guest-checkout/express-checkout/confirm", {
      method: "POST",
      headers: await guestHeaders(app),
      body: JSON.stringify({ ...confirmBody, email: "grace@example.com" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "commerce_upstream_failed",
      code: "shop.out_of_stock",
      message: "This print has just sold out",
    });
  });
});
