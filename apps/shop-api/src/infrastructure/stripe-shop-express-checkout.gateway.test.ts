import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { EXPRESS_SHIPPING_RATES } from "../application/express-checkout/express-shipping-rates.js";
import { createStripeShopExpressCheckoutGateway } from "./stripe-shop-express-checkout.gateway.js";

const BASKET = "22222222-2222-4222-8222-222222222222";
const ORDER = "11111111-1111-4111-8111-111111111111";

function fakeClient(session: Partial<Stripe.Checkout.Session> = {}) {
  const base = {
    id: "cs_test_express",
    client_secret: "cs_test_express_secret_abc",
    expires_at: 1_800_000_000,
    ui_mode: "custom",
    mode: "payment",
    status: "open",
    currency: "gbp",
    amount_subtotal: 9_000,
    amount_total: 10_500,
    metadata: { app: "shop", checkout: "express", basketId: BASKET },
    ...session,
  };
  const create = vi.fn(async () => base);
  const retrieve = vi.fn(async () => base);
  const update = vi.fn(async () => base);
  const stripe = { checkout: { sessions: { create, retrieve, update } } } as unknown as Stripe;
  return { stripe, create, retrieve, update };
}

const LINES = [
  { title: "Blue Horizon", description: "Jane Artist", quantity: 1, unitAmountPence: 8_000 },
  { title: "Oak frame", description: "Framing", quantity: 1, unitAmountPence: 1_000 },
];

describe("Stripe express checkout gateway", () => {
  it("opens an Elements-mode session for the basket: both UK rates, GB only, server-set shipping", async () => {
    const { stripe, create } = fakeClient();
    const gateway = createStripeShopExpressCheckoutGateway({ secretKey: undefined, stripe });
    const expiresAt = new Date(1_800_000_000_000);
    const session = await gateway.createExpressCheckout({
      basketId: BASKET,
      idempotencyKey: "checkout:shop-express:key",
      lines: LINES,
      subtotalPence: 9_000,
      shippingRates: EXPRESS_SHIPPING_RATES,
      returnUrl: "https://shop.example/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}",
      expiresAt,
      customerEmail: "ada@example.com",
    });
    expect(session).toEqual({
      sessionId: "cs_test_express",
      clientSecret: "cs_test_express_secret_abc",
      expiresAt,
    });
    const [params, requestOptions] = create.mock.calls[0] as unknown as [
      Stripe.Checkout.SessionCreateParams,
      Stripe.RequestOptions,
    ];
    expect(requestOptions.idempotencyKey).toMatch(/^checkout:shop-express:key:[0-9a-f]{32}$/);
    expect(params).toMatchObject({
      mode: "payment",
      ui_mode: "custom",
      return_url: "https://shop.example/checkout/confirmation?session_id={CHECKOUT_SESSION_ID}",
      expires_at: 1_800_000_000,
      customer_email: "ada@example.com",
      shipping_address_collection: { allowed_countries: ["GB"] },
      permissions: { update_shipping_details: "server_only" },
      metadata: { app: "shop", checkout: "express", basketId: BASKET },
      payment_intent_data: {
        metadata: { app: "shop", checkout: "express", basketId: BASKET },
        statement_descriptor_suffix: "LAX SHOP",
      },
    });
    expect(params.metadata).not.toHaveProperty("orderId");
    expect(params.shipping_options).toEqual([
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Insured UK delivery",
          fixed_amount: { amount: 1_500, currency: "gbp" },
          metadata: { fulfilment: "uk_insured_delivery" },
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Collect from our London gallery",
          fixed_amount: { amount: 0, currency: "gbp" },
          metadata: { fulfilment: "collect_new_cavendish" },
        },
      },
    ]);
    // Money in whole pence; the lines add up to the subtotal, with no delivery line.
    expect(params.line_items?.map((item) => [item.quantity, item.price_data?.unit_amount])).toEqual(
      [
        [1, 8_000],
        [1, 1_000],
      ],
    );
  });

  it("refuses lines that do not add up to the subtotal", async () => {
    const { stripe, create } = fakeClient();
    const gateway = createStripeShopExpressCheckoutGateway({ secretKey: undefined, stripe });
    await expect(
      gateway.createExpressCheckout({
        basketId: BASKET,
        idempotencyKey: "k",
        lines: LINES,
        subtotalPence: 9_001,
        shippingRates: EXPRESS_SHIPPING_RATES,
        returnUrl: "https://shop.example/x",
        expiresAt: new Date(),
      }),
    ).rejects.toMatchObject({ statusCode: 500 });
    expect(create).not.toHaveBeenCalled();
  });

  it("reads where a session has got to, telling the Shop's express sessions from others", async () => {
    const own = fakeClient();
    const gateway = createStripeShopExpressCheckoutGateway({
      secretKey: undefined,
      stripe: own.stripe,
    });
    expect(await gateway.readExpressCheckout({ sessionId: "cs_test_express" })).toEqual({
      sessionId: "cs_test_express",
      status: "open",
      isShopExpress: true,
      basketId: BASKET,
      orderId: null,
      currency: "gbp",
      amountSubtotalPence: 9_000,
    });

    const hosted = fakeClient({ ui_mode: "hosted", metadata: { app: "shop", orderId: ORDER } });
    const hostedGateway = createStripeShopExpressCheckoutGateway({
      secretKey: undefined,
      stripe: hosted.stripe,
    });
    expect(
      (await hostedGateway.readExpressCheckout({ sessionId: "cs_test_hosted" }))?.isShopExpress,
    ).toBe(false);
  });

  it("answers null for a session Stripe does not know", async () => {
    const { stripe, retrieve } = fakeClient();
    retrieve.mockRejectedValueOnce(
      Object.assign(new Error("No such"), { code: "resource_missing" }),
    );
    const gateway = createStripeShopExpressCheckoutGateway({ secretKey: undefined, stripe });
    expect(await gateway.readExpressCheckout({ sessionId: "cs_test_gone" })).toBeNull();
  });

  it("binds the order on confirm: order id and reference, the chosen rate alone, the wallet address", async () => {
    const { stripe, update } = fakeClient();
    const gateway = createStripeShopExpressCheckoutGateway({ secretKey: undefined, stripe });
    const rate = EXPRESS_SHIPPING_RATES[0];
    if (!rate) throw new Error("rate");
    const bound = await gateway.bindExpressCheckout({
      sessionId: "cs_test_express",
      orderId: ORDER,
      orderReference: "LAX-S-10482",
      basketId: BASKET,
      shippingRate: rate,
      shipping: {
        name: "Ada Lovelace",
        line1: "1 High Street",
        city: "London",
        postcode: "SW1A 1AA",
        country: "GB",
      },
      idempotencyKey: `checkout:shop-express-bind:${ORDER}`,
    });
    expect(bound).toEqual({ amountTotalPence: 10_500 });
    const [sessionId, params, requestOptions] = update.mock.calls[0] as unknown as [
      string,
      Stripe.Checkout.SessionUpdateParams,
      Stripe.RequestOptions,
    ];
    expect(sessionId).toBe("cs_test_express");
    expect(params.metadata).toEqual({
      app: "shop",
      checkout: "express",
      basketId: BASKET,
      orderId: ORDER,
      orderReference: "LAX-S-10482",
    });
    expect(params.shipping_options).toHaveLength(1);
    expect(params.collected_information).toEqual({
      shipping_details: {
        name: "Ada Lovelace",
        address: { line1: "1 High Street", city: "London", postal_code: "SW1A 1AA", country: "GB" },
      },
    });
    expect(requestOptions.idempotencyKey).toMatch(
      new RegExp(`^checkout:shop-express-bind:${ORDER}:[0-9a-f]{32}$`),
    );
  });

  it("is unavailable without a Stripe key", async () => {
    const gateway = createStripeShopExpressCheckoutGateway({ secretKey: undefined });
    await expect(gateway.readExpressCheckout({ sessionId: "cs_test_x" })).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
