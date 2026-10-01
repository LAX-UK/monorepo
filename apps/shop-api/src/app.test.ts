import { describe, expect, it } from "vitest";
import { createShopApiApp } from "./app.js";
import { createMinimalShopApiTestDeps } from "./test-app-deps.js";

describe("createShopApiApp", () => {
  it("serves live health without database coupling", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({ method: "GET", url: "/health/live" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ service: "shop-api", status: "ok" });
    await app.close();
  });

  it("keeps default JSON parsing for commerce routes when stripe webhook is registered", async () => {
    const deps = createMinimalShopApiTestDeps({
      stripeWebhook: {
        webhookSecret: "whsec_test",
        verifyWebhook: () => ({ type: "checkout.session.completed" }),
        parseCheckoutSessionCompleted: () => null,
        parseCheckoutSessionExpired: () => null,
        parseCheckoutSessionAsyncPaymentFailed: () => null,
        completeCheckout: async () => "processed" as const,
        expireCheckout: async () => "processed" as const,
        failCheckout: async () => "processed" as const,
        recordCurrencyViolation: async () => "processed" as const,
      },
      commerce: {
        ...createMinimalShopApiTestDeps().commerce,
        upsertBasketLine: async ({ artworkSlug, quantity }) => ({
          basketId: "b1",
          owner: { kind: "anonymous", tokenHash: "h" },
          expiresAt: new Date("2030-01-01T00:00:00.000Z"),
          lines: [
            {
              lineId: "l1",
              artworkId: "a1",
              artworkSlug,
              artworkTitle: "Title",
              unitPricePence: 100,
              livePricePence: 100,
              quantity,
              sellableCount: 3,
              imageUrl: null,
            },
          ],
        }),
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "PUT",
      url: "/v1/basket/lines",
      headers: {
        authorization: "Bearer test-bff-token-minimum-32-characters-long",
        "x-shop-basket-token": "anon-token-0123456789012345678901234567890",
        "content-type": "application/json",
      },
      payload: { artworkSlug: "demo-slug", quantity: 1 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      lines: [{ artworkSlug: "demo-slug", quantity: 1 }],
    });
    await app.close();
  });

  it("does not register portal ownership routes unless SHOP_PORTAL_OWNERSHIP_ENABLED", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_PORTAL_OWNERSHIP_ENABLED: false,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/editions",
      headers: { authorization: "Bearer test-bff-token-minimum-32-characters-long" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("does not register admin routes unless SHOP_ADMIN_ENABLED", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: false,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/admin/v1/health",
      headers: { authorization: "Bearer test-bff-token-minimum-32-characters-long" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("does not register portal payout routes unless SHOP_PAYOUTS_ENABLED", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_PORTAL_OWNERSHIP_ENABLED: true,
        SHOP_PAYOUTS_ENABLED: false,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const response = await app.inject({
      method: "GET",
      url: "/v1/me/payouts",
      headers: { authorization: "Bearer test-bff-token-minimum-32-characters-long" },
    });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("does not register phase 2+ admin routes when feature flags are off", async () => {
    const deps = createMinimalShopApiTestDeps({
      env: {
        ...createMinimalShopApiTestDeps().env,
        SHOP_ADMIN_ENABLED: true,
        SHOP_PAYOUTS_ENABLED: false,
        SHOP_THIRD_PARTY_ENABLED: false,
        SHOP_ORIGINALS_ENABLED: false,
        SHOP_MERCHANDISE_ENABLED: false,
      },
    });
    const app = createShopApiApp({ deps, logger: false });
    await app.ready();
    const routes: Array<{ method: "GET" | "POST"; url: string }> = [
      { method: "POST", url: "/admin/v1/production/tasks" },
      { method: "POST", url: "/admin/v1/holds" },
      { method: "POST", url: "/admin/v1/original-sales" },
      { method: "GET", url: "/admin/v1/merchandise/products" },
    ];
    for (const { method, url } of routes) {
      expect(app.hasRoute({ method, url }), url).toBe(false);
    }
    await app.close();
  });

  it("registers swagger metadata", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const document = app.swagger();
    expect(document.info?.title).toBe("LAX Shop API");
    const docsUi = await app.inject({ method: "GET", url: "/docs" });
    expect(docsUi.statusCode).toBe(200);
    await app.close();
  });
});
