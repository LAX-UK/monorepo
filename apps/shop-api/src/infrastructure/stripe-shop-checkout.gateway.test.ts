import { describe, expect, it } from "vitest";
import { createStripeShopCheckoutGateway } from "./stripe-shop-checkout.gateway.js";

describe("createStripeShopCheckoutGateway", () => {
  it("fails closed when Stripe is not configured and fake checkout is disabled", async () => {
    const gateway = createStripeShopCheckoutGateway({
      secretKey: undefined,
      storefrontUrl: "http://localhost:3020",
      fakeCheckoutEnabled: false,
    });
    await expect(
      gateway.createHostedCheckout({
        orderId: "11111111-1111-4111-8111-111111111111",
        totalPence: 1000,
        successUrl: "http://localhost:3020/ok?orderId={ORDER_ID}",
        cancelUrl: "http://localhost:3020/basket?orderId={ORDER_ID}",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toMatchObject({ statusCode: 503 });
  });

  it("allows explicit fake checkout in local development", async () => {
    const gateway = createStripeShopCheckoutGateway({
      secretKey: undefined,
      storefrontUrl: "http://localhost:3020",
      fakeCheckoutEnabled: true,
    });
    const session = await gateway.createHostedCheckout({
      orderId: "11111111-1111-4111-8111-111111111111",
      totalPence: 1000,
      successUrl: "http://localhost:3020/ok?orderId={ORDER_ID}",
      cancelUrl: "http://localhost:3020/basket?orderId={ORDER_ID}",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(session.checkoutUrl).toContain("orderId=11111111-1111-4111-8111-111111111111");
  });
});
