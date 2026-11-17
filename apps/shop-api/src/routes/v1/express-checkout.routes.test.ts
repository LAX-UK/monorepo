import { createHash } from "node:crypto";
import { EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE, SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import {
  type ExpressCheckoutService,
  createExpressCheckoutService,
} from "../../application/express-checkout/express-checkout.service.js";
import type { ExpressCheckoutGateway } from "../../application/ports/express-checkout.ports.js";
import type { CommerceRoutesDeps, GuestCheckoutRoutesDeps } from "../../commerce-route-deps.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const BASKET = "1f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b";
const ORDER = "8f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b";
const SESSION = "cs_test_a1B2c3D4e5";
const userHeaders = { authorization: "Bearer user-token" };
const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
  "x-lax-client-ip": "203.0.113.9",
  "x-shop-basket-token": "basket-token-1",
};
const TOKEN_HASH = createHash("sha256").update("basket-token-1", "utf8").digest("hex");

const ADDRESS = {
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  city: "London",
  postcode: "SW1A 1AA",
  country: "GB",
};

function expressService() {
  const gateway: ExpressCheckoutGateway = {
    createExpressCheckout: vi.fn(async (input) => ({
      sessionId: SESSION,
      clientSecret: `${SESSION}_secret_x`,
      expiresAt: input.expiresAt,
    })),
    readExpressCheckout: vi.fn(async () => ({
      sessionId: SESSION,
      status: "open" as const,
      isShopExpress: true,
      basketId: BASKET,
      orderId: null,
      currency: "gbp",
      amountSubtotalPence: 8_000,
      amountTotalPence: 8_000,
      shippingOptionAmountsPence: [1_500, 0],
      shippingDetails: null,
      bindRevision: 0,
    })),
    bindExpressCheckout: vi.fn(async () => ({ amountTotalPence: 9_500 })),
  };
  const baskets = {
    loadExpressBasket: vi.fn(async () => ({
      lines: [{ title: "Print", description: "Artist", quantity: 1, unitAmountPence: 8_000 }],
      subtotalPence: 8_000,
      contentKey: "content",
    })),
    assertBasketOwned: vi.fn(async () => undefined),
  };
  const service = createExpressCheckoutService({
    baskets,
    gateway,
    storefrontUrl: "http://localhost:3020",
  });
  return { service, gateway, baskets };
}

const placed = {
  orderId: ORDER,
  checkoutUrl: `http://localhost:3020/checkout/confirmation?orderId=${ORDER}`,
  expiresAt: new Date("2026-11-17T12:31:00Z"),
};

async function buildApp(options: {
  expressCheckout?: ExpressCheckoutService;
  checkoutOrder?: CommerceRoutesDeps["checkoutOrder"];
  guestCheckout?: Partial<GuestCheckoutRoutesDeps>;
}) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      commerce: {
        ...base.commerce,
        ...(options.expressCheckout ? { expressCheckout: options.expressCheckout } : {}),
        ...(options.checkoutOrder ? { checkoutOrder: options.checkoutOrder } : {}),
        ...(options.guestCheckout
          ? { guestCheckout: options.guestCheckout as GuestCheckoutRoutesDeps }
          : {}),
      },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("express checkout routes", () => {
  it("refuses every route while SHOP_EXPRESS_CHECKOUT is off", async () => {
    const checkoutOrder = vi.fn();
    const app = await buildApp({ checkoutOrder });
    for (const url of [
      "/v1/orders/express-checkout",
      "/v1/orders/express-checkout/shipping-address",
      "/v1/orders/express-checkout/confirm",
      "/v1/guest-checkout/express-checkout",
      "/v1/guest-checkout/express-checkout/shipping-address",
      "/v1/guest-checkout/express-checkout/confirm",
    ]) {
      const response = await app.inject({
        method: "POST",
        url,
        headers: url.includes("guest") ? bffHeaders : userHeaders,
        payload: {},
      });
      expect([400, 404]).toContain(response.statusCode);
    }
    const started = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout",
      headers: userHeaders,
      payload: { basketId: BASKET },
    });
    expect(started.statusCode).toBe(404);
    expect(started.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.FEATURE_DISABLED });
    expect(checkoutOrder).not.toHaveBeenCalled();
  });

  it("opens a session for a signed-in shopper's basket", async () => {
    const { service, baskets } = expressService();
    const app = await buildApp({ expressCheckout: service });
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout",
      headers: userHeaders,
      payload: { basketId: BASKET },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      sessionId: SESSION,
      clientSecret: `${SESSION}_secret_x`,
      expiresAt: expect.any(String),
      currency: "gbp",
      subtotalPence: 8_000,
      shippingRates: [
        { id: "uk_insured_delivery", displayName: "Insured UK delivery", amountPence: 1_500 },
        {
          id: "collect_new_cavendish",
          displayName: "Collect from our London gallery",
          amountPence: 0,
        },
      ],
    });
    const [{ ownedBy }] = baskets.loadExpressBasket.mock.calls[0] as unknown as [
      { ownedBy: (owner: unknown) => boolean },
    ];
    expect(ownedBy({ kind: "subject", identitySubjectId: "collector-1" })).toBe(true);
  });

  it("answers the address change with the UK rates, and refuses an address abroad", async () => {
    const { service } = expressService();
    const app = await buildApp({ expressCheckout: service });
    const uk = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout/shipping-address",
      headers: userHeaders,
      payload: { basketId: BASKET, sessionId: SESSION, address: { country: "GB", city: "Leeds" } },
    });
    expect(uk.statusCode).toBe(200);
    expect(uk.json().shippingRates).toHaveLength(2);

    const abroad = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout/shipping-address",
      headers: userHeaders,
      payload: { basketId: BASKET, sessionId: SESSION, address: { country: "FR" } },
    });
    expect(abroad.statusCode).toBe(400);
  });

  it("refuses a session id that is not one Stripe issues", async () => {
    const { service } = expressService();
    const app = await buildApp({ expressCheckout: service });
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout/confirm",
      headers: userHeaders,
      payload: {
        basketId: BASKET,
        sessionId: "not-a-session",
        shippingRateId: "uk_insured_delivery",
        name: "Ada",
        phone: "07700 900123",
        shippingAddress: ADDRESS,
      },
    });
    expect(response.statusCode).toBe(400);
  });

  it("confirms a signed-in order through the checkout writer", async () => {
    const { service } = expressService();
    const checkoutOrder = vi.fn(async () => placed);
    const app = await buildApp({ expressCheckout: service, checkoutOrder });
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout/confirm",
      headers: userHeaders,
      payload: {
        basketId: BASKET,
        sessionId: SESSION,
        shippingRateId: "uk_insured_delivery",
        name: "Ada Lovelace",
        phone: "07700 900123",
        shippingAddress: ADDRESS,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      orderId: ORDER,
      returnUrl: `http://localhost:3020/checkout/confirmation?orderId=${ORDER}`,
      expiresAt: "2026-11-17T12:31:00.000Z",
    });
    expect(checkoutOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "collector-1",
        basketId: BASKET,
        fulfilment: "uk_insured_delivery",
        idempotencyKey: `express:${SESSION}`,
        express: expect.objectContaining({ sessionId: SESSION }),
      }),
    );
  });

  it("fails a confirm with 'This print has just sold out'", async () => {
    const { service } = expressService();
    const checkoutOrder = vi.fn(async () => {
      throw new ShopApiError(SHOP_API_ERROR_CODES.OUT_OF_STOCK, "Edition unavailable", 409);
    });
    const app = await buildApp({ expressCheckout: service, checkoutOrder });
    const response = await app.inject({
      method: "POST",
      url: "/v1/orders/express-checkout/confirm",
      headers: userHeaders,
      payload: {
        basketId: BASKET,
        sessionId: SESSION,
        shippingRateId: "collect_new_cavendish",
        name: "Ada Lovelace",
        shippingAddress: ADDRESS,
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: SHOP_API_ERROR_CODES.OUT_OF_STOCK,
      message: EXPRESS_CHECKOUT_SOLD_OUT_MESSAGE,
    });
  });

  describe("guests", () => {
    function guest() {
      return {
        service: {
          placeOrder: vi.fn(async () => ({
            kind: "created" as const,
            session: placed,
            access: { token: "t".repeat(43), expiresAt: new Date("2026-12-17T12:00:00Z") },
          })),
        },
      } as unknown as GuestCheckoutRoutesDeps;
    }

    it("are for the storefront only, with the browser's basket", async () => {
      const { service, baskets } = expressService();
      const app = await buildApp({ expressCheckout: service, guestCheckout: guest() });
      const asUser = await app.inject({
        method: "POST",
        url: "/v1/guest-checkout/express-checkout",
        headers: userHeaders,
        payload: { basketId: BASKET },
      });
      expect(asUser.statusCode).toBe(403);

      const response = await app.inject({
        method: "POST",
        url: "/v1/guest-checkout/express-checkout",
        headers: bffHeaders,
        payload: { basketId: BASKET },
      });
      expect(response.statusCode).toBe(200);
      const [{ ownedBy }] = baskets.loadExpressBasket.mock.calls[0] as unknown as [
        { ownedBy: (owner: unknown) => boolean },
      ];
      expect(ownedBy({ kind: "anonymous", tokenHash: TOKEN_HASH })).toBe(true);
      expect(ownedBy({ kind: "anonymous", tokenHash: "other" })).toBe(false);
    });

    it("confirm through guest checkout, with the email check, and get the order link", async () => {
      const { service } = expressService();
      const deps = guest();
      const app = await buildApp({ expressCheckout: service, guestCheckout: deps });
      const response = await app.inject({
        method: "POST",
        url: "/v1/guest-checkout/express-checkout/confirm",
        headers: bffHeaders,
        payload: {
          basketId: BASKET,
          sessionId: SESSION,
          shippingRateId: "uk_insured_delivery",
          name: "Ada Lovelace",
          phone: "07700 900123",
          shippingAddress: ADDRESS,
          email: "ada@example.com",
          marketingConsent: true,
        },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        orderId: ORDER,
        returnUrl: `http://localhost:3020/checkout/confirmation?orderId=${ORDER}`,
        orderAccessToken: "t".repeat(43),
      });
      expect(deps.service.placeOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "ada@example.com",
          name: "Ada Lovelace",
          phone: "07700 900123",
          marketingConsent: true,
          basketTokenHash: TOKEN_HASH,
          clientIp: "203.0.113.9",
          idempotencyKey: `express:${SESSION}`,
          express: expect.objectContaining({ sessionId: SESSION }),
        }),
      );
    });

    it("are told to sign in when the wallet's email has a LAX account", async () => {
      const { service } = expressService();
      const deps = guest();
      vi.mocked(deps.service.placeOrder).mockResolvedValueOnce({ kind: "sign_in_required" });
      const app = await buildApp({ expressCheckout: service, guestCheckout: deps });
      const response = await app.inject({
        method: "POST",
        url: "/v1/guest-checkout/express-checkout/confirm",
        headers: bffHeaders,
        payload: {
          basketId: BASKET,
          sessionId: SESSION,
          shippingRateId: "collect_new_cavendish",
          name: "Ada Lovelace",
          shippingAddress: ADDRESS,
          email: "ada@example.com",
        },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: SHOP_API_ERROR_CODES.ACCOUNT_EXISTS });
    });
  });
});
