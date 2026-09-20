import { describe, expect, it } from "vitest";
import { createShopApiApp } from "../../app.js";
import { createMinimalShopApiTestDeps } from "../../test-app-deps.js";

describe("POST /webhooks/stripe", () => {
  it("rejects when webhook secret is not configured", async () => {
    const app = createShopApiApp({ deps: createMinimalShopApiTestDeps(), logger: false });
    await app.ready();
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      payload: Buffer.from("{}"),
      headers: { "content-type": "application/json", "stripe-signature": "sig" },
    });
    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it("accepts payloads larger than the default 1kb body limit when configured", async () => {
    const app = createShopApiApp({
      deps: createMinimalShopApiTestDeps({
        stripeWebhook: {
          webhookSecret: "whsec_test",
          verifyWebhook: () => {
            throw new Error("Invalid signature");
          },
          parseCheckoutSessionCompleted: () => null,
          parseCheckoutSessionExpired: () => null,
          parseCheckoutSessionAsyncPaymentFailed: () => null,
          completeCheckout: async () => "processed",
          expireCheckout: async () => "processed" as const,
          failCheckout: async () => "processed" as const,
        },
      }),
      logger: false,
    });
    await app.ready();
    const largePayload = Buffer.alloc(8 * 1024, 123);
    const response = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      payload: largePayload,
      headers: { "content-type": "application/json", "stripe-signature": "invalid" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("Invalid signature");
    await app.close();
  });
});
