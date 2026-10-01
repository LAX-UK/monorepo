import { describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: createMock,
        retrieve: vi.fn(),
      },
    },
  })),
}));

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
        lines: [
          {
            title: "Blue Horizon",
            description: "Jane Artist · Edition 3",
            quantity: 1,
            unitAmountPence: 900,
            imageUrl: "https://cdn.example/art.jpg",
          },
        ],
        fulfilmentSurchargePence: 100,
        customerEmail: "buyer@example.com",
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
      lines: [
        {
          title: "Test print",
          description: "Edition 1",
          quantity: 1,
          unitAmountPence: 1000,
          imageUrl: null,
        },
      ],
      fulfilmentSurchargePence: 0,
    });
    expect(session.checkoutUrl).toContain("orderId=11111111-1111-4111-8111-111111111111");
  });

  it("passes artwork line items, delivery surcharge, and customer email to Stripe", async () => {
    createMock.mockResolvedValueOnce({
      url: "https://checkout.stripe.com/c/pay/cs_test",
      id: "cs_test",
      payment_intent: null,
    });
    const gateway = createStripeShopCheckoutGateway({
      secretKey: "sk_test_mock",
      storefrontUrl: "http://localhost:3020",
      fakeCheckoutEnabled: false,
    });
    await gateway.createHostedCheckout({
      orderId: "11111111-1111-4111-8111-111111111111",
      totalPence: 1000,
      successUrl: "http://localhost:3020/ok?orderId={ORDER_ID}",
      cancelUrl: "http://localhost:3020/basket?orderId={ORDER_ID}",
      expiresAt: new Date(Date.now() + 60_000),
      lines: [
        {
          title: "Blue Horizon",
          description: "Jane Artist · Edition 3",
          quantity: 1,
          unitAmountPence: 900,
          imageUrl: "https://cdn.example/art.jpg",
        },
      ],
      fulfilmentSurchargePence: 100,
      customerEmail: "buyer@example.com",
    });

    expect(createMock).toHaveBeenCalledTimes(1);
    const [params] = createMock.mock.calls[0] ?? [];
    expect(params.customer_email).toBe("buyer@example.com");
    expect(params.locale).toBe("en-GB");
    expect(params.line_items).toHaveLength(2);
    expect(params.line_items[0].price_data.product_data.name).toBe("Blue Horizon");
    expect(params.line_items[0].price_data.product_data.images).toEqual([
      "https://cdn.example/art.jpg",
    ]);
    expect(params.line_items[1].price_data.product_data.name).toBe("Delivery & fulfilment");
  });
});
