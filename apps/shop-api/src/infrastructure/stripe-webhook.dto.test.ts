import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  isShopOwnedPaymentIntentMetadata,
  parseChargeRefunded,
  parseCheckoutSessionAsyncPaymentFailed,
  parseCheckoutSessionCompleted,
  parseCheckoutSessionExpired,
  parseDisputeEvent,
  parseStripeRefundEvent,
} from "./stripe-webhook.dto.js";

describe("stripe webhook DTO", () => {
  it("parses checkout.session.completed", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      data: {
        object: {
          id: "cs_test_completed",
          metadata: { app: "shop", orderId: "11111111-1111-4111-8111-111111111111" },
          amount_total: 4200,
          currency: "gbp",
          payment_status: "paid",
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toEqual({
      eventId: "evt_1",
      paidAt: new Date(1_700_000_000 * 1000),
      orderId: "11111111-1111-4111-8111-111111111111",
      sessionId: "cs_test_completed",
      amountTotalPence: 4200,
      customerEmail: null,
    });
  });

  it("parses checkout.session.async_payment_succeeded", () => {
    const event = {
      id: "evt_async_ok",
      type: "checkout.session.async_payment_succeeded",
      created: 1_700_000_001,
      data: {
        object: {
          id: "cs_test_async_ok",
          metadata: { app: "shop", orderId: "11111111-1111-4111-8111-111111111111" },
          amount_total: 4200,
          currency: "gbp",
          payment_status: "paid",
          customer_details: { email: "buyer@example.com" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toMatchObject({
      eventId: "evt_async_ok",
      customerEmail: "buyer@example.com",
    });
  });

  it("parses checkout.session.async_payment_failed", () => {
    const event = {
      id: "evt_async_fail",
      type: "checkout.session.async_payment_failed",
      created: 1,
      data: {
        object: {
          id: "cs_test_async_fail",
          metadata: { app: "shop", orderId: "33333333-3333-4333-8333-333333333333" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionAsyncPaymentFailed(event)).toEqual({
      eventId: "evt_async_fail",
      orderId: "33333333-3333-4333-8333-333333333333",
      sessionId: "cs_test_async_fail",
    });
  });

  it("ignores foreign checkout sessions tagged for another product", () => {
    const event = {
      id: "evt_bid",
      type: "checkout.session.completed",
      created: 1,
      data: {
        object: {
          metadata: { app: "bid", paymentId: "pay_1" },
          amount_total: 4200,
          currency: "gbp",
          payment_status: "paid",
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toBeNull();
  });

  it("returns null when payment is not settled", () => {
    const event = {
      id: "evt_unpaid",
      type: "checkout.session.completed",
      created: 1,
      data: {
        object: {
          metadata: { app: "shop", orderId: "11111111-1111-4111-8111-111111111111" },
          amount_total: 4200,
          currency: "gbp",
          payment_status: "unpaid",
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toBeNull();
  });

  it("returns null when checkout metadata is missing", () => {
    const event = {
      id: "evt_2",
      type: "checkout.session.completed",
      created: 1,
      data: { object: { metadata: {}, amount_total: null } },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toBeNull();
  });

  it("parses checkout.session.expired", () => {
    const event = {
      id: "evt_3",
      type: "checkout.session.expired",
      created: 1,
      data: {
        object: {
          id: "cs_test_expired",
          metadata: { app: "shop", orderId: "22222222-2222-4222-8222-222222222222" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionExpired(event)).toEqual({
      eventId: "evt_3",
      orderId: "22222222-2222-4222-8222-222222222222",
      sessionId: "cs_test_expired",
    });
  });

  it("detects shop-owned payment intent metadata", () => {
    expect(isShopOwnedPaymentIntentMetadata({ app: "shop" })).toBe(true);
    expect(isShopOwnedPaymentIntentMetadata({ app: "bid" })).toBe(false);
    expect(isShopOwnedPaymentIntentMetadata(undefined)).toBe(false);
  });

  it("parses charge.refunded", () => {
    const event = {
      id: "evt_refund",
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_shop",
          amount_refunded: 500,
          refunds: { data: [{ id: "re_1", amount: 500, status: "succeeded" }] },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseChargeRefunded(event)).toMatchObject({
      eventId: "evt_refund",
      stripeRefundId: "re_1",
      paymentIntentId: "pi_shop",
      amountPence: 500,
      status: "succeeded",
    });
  });

  it("parses charge.dispute.created", () => {
    const event = {
      id: "evt_disp",
      type: "charge.dispute.created",
      data: {
        object: {
          id: "dp_1",
          payment_intent: "pi_shop",
          amount: 1200,
          status: "needs_response",
        },
      },
    } as unknown as Stripe.Event;
    expect(parseDisputeEvent(event)).toMatchObject({
      stripeDisputeId: "dp_1",
      paymentIntentId: "pi_shop",
      status: "opened",
    });
  });

  it("parses refund.created with shop_refund_id metadata", () => {
    const shopRefundId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const event = {
      id: "evt_refund_created",
      type: "refund.created",
      data: {
        object: {
          id: "re_shop_phase2",
          payment_intent: "pi_shop_owned",
          amount: 1500,
          status: "succeeded",
          metadata: { shop_refund_id: shopRefundId },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseStripeRefundEvent(event)).toEqual({
      eventId: "evt_refund_created",
      stripeRefundId: "re_shop_phase2",
      paymentIntentId: "pi_shop_owned",
      amountPence: 1500,
      status: "succeeded",
      shopRefundId,
      source: "refund.created",
    });
  });

  it("returns null for refund.created without payment intent", () => {
    const event = {
      id: "evt_refund_orphan",
      type: "refund.created",
      data: {
        object: {
          id: "re_orphan",
          amount: 100,
          status: "pending",
          metadata: { shop_refund_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseStripeRefundEvent(event)).toBeNull();
  });

  it("ignores legacy shop sessions without app metadata", () => {
    const event = {
      id: "evt_legacy",
      type: "checkout.session.completed",
      created: 1,
      data: {
        object: {
          id: "cs_legacy",
          metadata: { orderId: "11111111-1111-4111-8111-111111111111" },
          amount_total: 4200,
          currency: "gbp",
          payment_status: "paid",
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionCompleted(event)).toBeNull();
  });
});
