import { describe, expect, it, vi } from "vitest";

vi.mock("@auction/auth/token-verifier", () => ({
  verifyBearerToken: vi.fn(async () => ({
    subject: "collector-1",
    payload: { scope: "shop.read shop.write" },
  })),
}));

import { createShopApiApp } from "../../app.js";
import type { GuestCheckoutService } from "../../application/guest-checkout/guest-checkout.service.js";
import type { GuestOrderLinks } from "../../application/ports/guest-checkout.ports.js";
import type { GuestCheckoutRoutesDeps } from "../../commerce-route-deps.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

const bffHeaders = {
  authorization: "Bearer test-bff-token-minimum-32-characters-long",
  "x-lax-client-ip": "203.0.113.9",
};
const userHeaders = { authorization: "Bearer user-token" };

function guestDeps(
  service: Partial<GuestCheckoutService> = {},
  links: Partial<GuestOrderLinks> = {},
): GuestCheckoutRoutesDeps {
  return {
    service: {
      checkEmail: vi.fn(async () => ({ kind: "continue_as_guest" as const })),
      placeOrder: vi.fn(async () => ({
        kind: "created" as const,
        session: {
          orderId: "8f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b",
          checkoutUrl: "https://pay.example/session",
          expiresAt: new Date("2026-10-30T12:30:00Z"),
        },
        access: { token: "t".repeat(43), expiresAt: new Date("2026-11-29T12:00:00Z") },
      })),
      ...service,
    },
    links: {
      issue: vi.fn(),
      resolve: vi.fn(async () => ({ kind: "not_found" as const })),
      resend: vi.fn(async () => undefined),
      cancelUnpaid: vi.fn(async () => undefined),
      ...links,
    },
    linkRateLimiter: { consume: vi.fn(async () => ({ allowed: true as const })) },
    getCustomerProfile: vi.fn(async () => ({ name: null, email: null })),
    invoiceIssuer: { supplier: {} as never, vatNumber: null },
  };
}

async function buildApp(guestCheckout: GuestCheckoutRoutesDeps | undefined) {
  const base = createMinimalShopApiTestDeps();
  const app = createShopApiApp({
    deps: createMinimalShopApiTestDeps({
      commerce: { ...base.commerce, ...(guestCheckout ? { guestCheckout } : {}) },
    }),
    logger: false,
  });
  await app.ready();
  return app;
}

describe("guest checkout routes", () => {
  it("answers the email step for the storefront only", async () => {
    const deps = guestDeps();
    const app = await buildApp(deps);
    const asUser = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/email-checks",
      headers: userHeaders,
      payload: { email: "ada@example.com" },
    });
    expect(asUser.statusCode).toBe(403);

    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/email-checks",
      headers: bffHeaders,
      payload: { email: "ada@example.com", marketingConsent: true },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "continue_as_guest" });
    expect(deps.service.checkEmail).toHaveBeenCalledWith({
      email: "ada@example.com",
      marketingConsent: true,
      clientIp: "203.0.113.9",
    });
  });

  it("stores nothing when the hidden field is filled", async () => {
    const deps = guestDeps();
    const app = await buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/email-checks",
      headers: bffHeaders,
      payload: { email: "ada@example.com", website: "spam.example" },
    });
    expect(response.statusCode).toBe(200);
    expect(deps.service.checkEmail).not.toHaveBeenCalled();
  });

  it("refuses an order for an email with a LAX account", async () => {
    const deps = guestDeps({
      placeOrder: vi.fn(async () => ({ kind: "sign_in_required" as const })),
    });
    const app = await buildApp(deps);
    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/orders",
      headers: { ...bffHeaders, "x-shop-basket-token": "basket-token-1" },
      payload: {
        basketId: "1f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b",
        email: "ada@example.com",
        name: "Ada Lovelace",
        fulfilment: "collect_new_cavendish",
        idempotencyKey: "guest-checkout:basket",
        successUrl: "http://localhost:3020/checkout/confirmation",
        cancelUrl: "http://localhost:3020/checkout/cancel",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("shop.account_exists");
  });

  it("returns the payment page and the order access token for a new guest", async () => {
    const app = await buildApp(guestDeps());
    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/orders",
      headers: { ...bffHeaders, "x-shop-basket-token": "basket-token-1" },
      payload: {
        basketId: "1f0a1c2e-3b4d-4e5f-8a6b-7c8d9e0f1a2b",
        email: "ada@example.com",
        name: "Ada Lovelace",
        fulfilment: "collect_new_cavendish",
        idempotencyKey: "guest-checkout:basket",
        successUrl: "http://localhost:3020/checkout/confirmation",
        cancelUrl: "http://localhost:3020/checkout/cancel",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      checkoutUrl: "https://pay.example/session",
      orderAccessToken: "t".repeat(43),
    });
  });

  it("says a link expired or the order moved to an account, without the order", async () => {
    const app = await buildApp(
      guestDeps(
        {},
        { resolve: vi.fn(async () => ({ kind: "claimed" as const, orderReference: "LAX-S-1" })) },
      ),
    );
    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-orders/open",
      headers: bffHeaders,
      payload: { token: "t".repeat(43) },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: "claimed", orderReference: "LAX-S-1" });
  });

  it("is unavailable without the Identity account check", async () => {
    const app = await buildApp(undefined);
    const response = await app.inject({
      method: "POST",
      url: "/v1/guest-checkout/email-checks",
      headers: bffHeaders,
      payload: { email: "ada@example.com" },
    });
    expect(response.statusCode).toBe(503);
  });
});
