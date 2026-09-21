import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  parseCheckoutSessionAsyncPaymentFailed,
  parseCheckoutSessionCompleted,
  parseCheckoutSessionExpired,
} from "./stripe-webhook.dto.js";

describe("stripe webhook DTO", () => {
  it("parses checkout.session.completed", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      created: 1_700_000_000,
      data: {
        object: {
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
          metadata: { app: "shop", orderId: "33333333-3333-4333-8333-333333333333" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionAsyncPaymentFailed(event)).toEqual({
      eventId: "evt_async_fail",
      orderId: "33333333-3333-4333-8333-333333333333",
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
          metadata: { app: "shop", orderId: "22222222-2222-4222-8222-222222222222" },
        },
      },
    } as unknown as Stripe.Event;
    expect(parseCheckoutSessionExpired(event)).toEqual({
      eventId: "evt_3",
      orderId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
