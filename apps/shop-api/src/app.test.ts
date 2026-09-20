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
