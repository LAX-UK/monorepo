import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { StripeCheckoutCloser } from "./stripe-checkout-closer.js";

type Fake = {
  sessions?: Record<string, Partial<Stripe.Checkout.Session>>;
  expire?: (id: string) => Partial<Stripe.Checkout.Session>;
  intents?: Record<string, Partial<Stripe.PaymentIntent>>;
  cancel?: (id: string) => Partial<Stripe.PaymentIntent>;
  search?: Partial<Stripe.PaymentIntent>[];
};

function stripe(fake: Fake) {
  const expire = vi.fn(async (id: string) => {
    if (!fake.expire) throw new Error("not open");
    return fake.expire(id);
  });
  const cancel = vi.fn(async (id: string) => {
    if (!fake.cancel) throw new Error("cannot cancel");
    return fake.cancel(id);
  });
  const client = {
    checkout: {
      sessions: { retrieve: vi.fn(async (id: string) => fake.sessions?.[id]), expire },
    },
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => fake.intents?.[id]),
      cancel,
      search: vi.fn(async () => ({ data: fake.search ?? [] })),
    },
  };
  return {
    closer: new StripeCheckoutCloser({ get: () => client as unknown as Stripe }),
    expire,
    cancel,
  };
}

const input = { paymentId: "pay-1", paymentIntentId: null, checkoutSessionIds: ["cs_1"] };

describe("StripeCheckoutCloser", () => {
  it("closes an open session with no payment, and reports no money", async () => {
    const { closer, expire } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "open", payment_intent: null } },
      expire: () => ({ id: "cs_1", status: "expired", payment_intent: null }),
    });
    await expect(closer.closeAndRead(input)).resolves.toEqual({ kind: "no_money" });
    expect(expire).toHaveBeenCalledWith("cs_1");
  });

  it("a session that completed while being closed is re-read and its payment reported", async () => {
    const { closer } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "complete", payment_intent: "pi_1" } },
      intents: {
        pi_1: {
          id: "pi_1",
          status: "succeeded",
          amount: 125_000,
          amount_received: 125_000,
          latest_charge: "ch_1",
        },
      },
    });
    await expect(closer.closeAndRead(input)).resolves.toEqual({
      kind: "paid",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      amountReceivedPence: 125_000,
    });
  });

  it("a card payment still processing is money on its way", async () => {
    const { closer, cancel } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "complete", payment_intent: "pi_1" } },
      intents: { pi_1: { id: "pi_1", status: "processing", amount: 100 } },
    });
    await expect(closer.closeAndRead(input)).resolves.toMatchObject({
      kind: "in_flight",
      reason: "processing",
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("a bank transfer received in part is never cancelled", async () => {
    const { closer, cancel } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "complete", payment_intent: "pi_1" } },
      intents: {
        pi_1: {
          id: "pi_1",
          status: "requires_action",
          amount: 125_000,
          next_action: {
            display_bank_transfer_instructions: { amount_remaining: 25_000 },
          } as Stripe.PaymentIntent.NextAction,
        },
      },
    });
    await expect(closer.closeAndRead(input)).resolves.toMatchObject({
      kind: "in_flight",
      reason: "transfer_part_funded",
    });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("an unfunded transfer is cancelled, and then reports no money", async () => {
    const { closer, cancel } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "complete", payment_intent: "pi_1" } },
      intents: {
        pi_1: {
          id: "pi_1",
          status: "requires_action",
          amount: 125_000,
          next_action: {
            display_bank_transfer_instructions: { amount_remaining: 125_000 },
          } as Stripe.PaymentIntent.NextAction,
        },
      },
      cancel: () => ({ id: "pi_1", status: "canceled", amount: 125_000 }),
    });
    await expect(closer.closeAndRead(input)).resolves.toEqual({ kind: "no_money" });
    expect(cancel).toHaveBeenCalledWith("pi_1", {}, { idempotencyKey: "cancel:pi_1" });
  });

  it("an intent we cannot cancel and that is not settled is unknown, so the invoice stays", async () => {
    const { closer } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "expired", payment_intent: null } },
      search: [{ id: "pi_9" }],
      intents: {
        pi_9: { id: "pi_9", status: "requires_confirmation", amount: 100, amount_received: 0 },
      },
    });
    await expect(closer.closeAndRead(input)).resolves.toMatchObject({ kind: "unknown" });
  });

  it("an intent that succeeds while we cancel it is re-read and reported paid", async () => {
    const retrieve = vi
      .fn()
      .mockResolvedValueOnce({ id: "pi_1", status: "requires_action", amount: 100 })
      .mockResolvedValueOnce({
        id: "pi_1",
        status: "succeeded",
        amount: 100,
        amount_received: 100,
        latest_charge: { id: "ch_1" },
      });
    const client = {
      checkout: { sessions: { retrieve: vi.fn(), expire: vi.fn() } },
      paymentIntents: {
        retrieve,
        cancel: vi.fn().mockRejectedValue(new Error("payment_intent_unexpected_state")),
        search: vi.fn().mockResolvedValue({ data: [] }),
      },
    };
    const closer = new StripeCheckoutCloser({ get: () => client as unknown as Stripe });
    await expect(
      closer.closeAndRead({ paymentId: "pay-1", paymentIntentId: "pi_1", checkoutSessionIds: [] }),
    ).resolves.toEqual({
      kind: "paid",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      amountReceivedPence: 100,
    });
  });

  it("a session still open after closing is unknown, so the invoice is not cancelled", async () => {
    const { closer } = stripe({
      sessions: { cs_1: { id: "cs_1", status: "open", payment_intent: null } },
    });
    await expect(closer.closeAndRead(input)).resolves.toEqual({
      kind: "unknown",
      error: "checkout_session_still_open",
    });
  });

  it("without Stripe, only an invoice that never reached Stripe may be cancelled", async () => {
    const closer = new StripeCheckoutCloser({ get: () => null }, { stripeExpected: false });
    await expect(closer.closeAndRead(input)).resolves.toMatchObject({ kind: "unknown" });
    await expect(
      closer.closeAndRead({ paymentId: "pay-1", paymentIntentId: null, checkoutSessionIds: [] }),
    ).resolves.toEqual({ kind: "no_money" });
  });

  it("where payments are taken, a missing Stripe client never counts as no money", async () => {
    const closer = new StripeCheckoutCloser({ get: () => null }, { stripeExpected: true });
    await expect(
      closer.closeAndRead({ paymentId: "pay-1", paymentIntentId: null, checkoutSessionIds: [] }),
    ).resolves.toEqual({ kind: "unknown", error: "stripe_not_configured" });
  });
});
