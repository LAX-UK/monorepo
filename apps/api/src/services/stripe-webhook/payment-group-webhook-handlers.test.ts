import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { createPaymentWebhookHandlers } from "./create-payment-webhook-handlers.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

const event = { id: "evt_1" } as Stripe.Event;
const groupIntent = {
  id: "pi_g",
  amount: 30_000,
  currency: "gbp",
  latest_charge: "ch_g",
  metadata: { paymentGroupId: "group-1" },
} as unknown as Stripe.PaymentIntent;
const singleIntent = (paymentId: string) =>
  ({ id: "pi_s", amount: 100, metadata: { paymentId } }) as unknown as Stripe.PaymentIntent;

function setup(payment: { paymentGroupId: string | null } | null = null, groupStatus = "open") {
  const settlement = {
    settle: vi.fn(async () => ({ processed: true, action: "payment_intent_succeeded" as const })),
    markProcessing: vi.fn(async () => ({ processed: true })),
    release: vi.fn(async () => ({ processed: true })),
  };
  const groups = {
    findById: vi.fn(async () => ({
      id: "group-1",
      status: groupStatus,
      stripeCheckoutSessionId: "cs_g",
      stripePaymentIntentId: "pi_g",
    })),
  };
  const gateway = { expireCheckout: vi.fn(async () => {}) };
  const payments = { findById: vi.fn(async () => payment) };
  // The single-invoice handlers find no payment row for a group's intent and skip; for single
  // intents the stubbed transaction never runs, so we only observe routing here.
  const singleDeps = {
    payments: { findById: vi.fn(async () => null) },
    transactionRunner: { runInTransaction: vi.fn() },
  } as unknown as StripePaymentWebhookDeps;
  const handlers = createPaymentWebhookHandlers(singleDeps, {
    settlement,
    chargeEvents: { chargeRefunded: vi.fn(), refundUpdated: vi.fn() },
    groups: groups as never,
    payments: payments as never,
    gateway,
  });
  return { handlers, settlement, gateway, singleDeps };
}

describe("payment webhooks with pay several", () => {
  it("sends a group's money to the group, with the amount and charge it carried", async () => {
    const { handlers, settlement, singleDeps } = setup();
    await handlers.paymentIntentSucceeded.handle(event, groupIntent);
    expect(settlement.settle).toHaveBeenCalledWith({
      eventId: "evt_1",
      groupId: "group-1",
      paymentIntentId: "pi_g",
      chargeId: "ch_g",
      amountPence: 30_000,
      currency: "gbp",
    });
    expect(singleDeps.payments.findById).not.toHaveBeenCalled();
  });

  it("holds the group's invoices while a bank transfer is under way or part-funded", async () => {
    const { handlers, settlement } = setup();
    await handlers.paymentIntentProcessing.handle(event, groupIntent);
    await handlers.paymentIntentPartiallyFunded.handle(event, groupIntent);
    expect(settlement.markProcessing).toHaveBeenCalledTimes(2);
  });

  it("stores what a part-funded transfer has delivered, stamped with the provider's event time", async () => {
    const { handlers, settlement } = setup();
    const partial = {
      ...event,
      id: "evt_part",
      created: 1_793_000_000,
    } as Stripe.Event;
    await handlers.paymentIntentPartiallyFunded.handle(partial, {
      ...groupIntent,
      amount_received: 12_000,
    } as Stripe.PaymentIntent);
    expect(settlement.markProcessing).toHaveBeenCalledWith({
      eventId: "evt_part",
      groupId: "group-1",
      received: {
        amountPence: 12_000,
        paymentIntentId: "pi_g",
        eventAt: new Date(1_793_000_000 * 1000),
      },
    });
  });

  it("reads what arrived from the provider's remaining amount, as the single-invoice handler does", async () => {
    const { handlers, settlement } = setup();
    const realistic = {
      ...groupIntent,
      amount: 30_000,
      amount_received: 0,
      status: "requires_action",
      next_action: {
        type: "display_bank_transfer_instructions",
        display_bank_transfer_instructions: {
          amount_remaining: 18_000,
          currency: "gbp",
          financial_addresses: [],
          hosted_instructions_url: "https://payments.stripe.com/instructions/test",
          reference: "LAXB7KQ2R9",
          type: "gb_bank_transfer",
        },
      },
    } as unknown as Stripe.PaymentIntent;
    await handlers.paymentIntentPartiallyFunded.handle(
      { ...event, id: "evt_real", created: 1_793_000_000 } as Stripe.Event,
      realistic,
    );
    expect(settlement.markProcessing).toHaveBeenCalledWith({
      eventId: "evt_real",
      groupId: "group-1",
      received: {
        amountPence: 12_000,
        paymentIntentId: "pi_g",
        eventAt: new Date(1_793_000_000 * 1000),
      },
    });
  });

  it("stores no figure for a transfer that has only started", async () => {
    const { handlers, settlement } = setup();
    await handlers.paymentIntentProcessing.handle(event, groupIntent);
    expect(settlement.markProcessing).toHaveBeenCalledWith({
      eventId: "evt_1",
      groupId: "group-1",
    });
  });

  it("keeps the group open after a declined card, and lets it go when the checkout ends", async () => {
    const { handlers, settlement } = setup();
    expect(await handlers.paymentIntentFailed.handle(event, groupIntent)).toMatchObject({
      reason: "payment_group_attempt_failed",
    });
    expect(settlement.release).not.toHaveBeenCalled();
    await handlers.paymentIntentCanceled.handle(event, groupIntent);
    const session = {
      metadata: { paymentGroupId: "group-1" },
    } as unknown as Stripe.Checkout.Session;
    await handlers.checkoutSessionExpired.handle(event, session);
    await handlers.checkoutSessionAsyncPaymentFailed.handle(event, session);
    expect(settlement.release.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      { eventId: "evt_1", groupId: "group-1", reason: "checkout_cancelled" },
      { eventId: "evt_1", groupId: "group-1", reason: "checkout_expired" },
      { eventId: "evt_1", groupId: "group-1", reason: "bank_transfer_failed" },
    ]);
  });

  it("ignores an expired single-invoice checkout, as before", async () => {
    const { handlers, settlement } = setup();
    const session = { metadata: { paymentId: "pay-1" } } as unknown as Stripe.Checkout.Session;
    expect(await handlers.checkoutSessionExpired.handle(event, session)).toMatchObject({
      reason: "not_a_payment_group",
    });
    expect(settlement.release).not.toHaveBeenCalled();
  });

  it("does not cancel an invoice a group holds when its own earlier checkout is cancelled", async () => {
    const { handlers, singleDeps } = setup({ paymentGroupId: "group-1" });
    expect(await handlers.paymentIntentCanceled.handle(event, singleIntent("pay-1"))).toMatchObject(
      { reason: "payment_in_group" },
    );
    expect(singleDeps.transactionRunner.runInTransaction).not.toHaveBeenCalled();
  });

  it("lets the group go when one of its invoices is paid on its own", async () => {
    const { handlers, settlement, gateway } = setup({ paymentGroupId: "group-1" });
    await handlers.paymentIntentSucceeded.handle(event, singleIntent("pay-1"));
    expect(gateway.expireCheckout).toHaveBeenCalledWith("cs_g");
    expect(settlement.release).toHaveBeenCalledWith({
      eventId: null,
      groupId: "group-1",
      reason: "invoice_paid_separately",
    });
  });

  it("flags an invoice paid on its own after its group was already paid", async () => {
    const { handlers, settlement } = setup({ paymentGroupId: "group-1" }, "paid");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await handlers.paymentIntentSucceeded.handle(event, singleIntent("pay-1"));
    expect(settlement.release).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("payment_group_invoice_paid_twice"));
    log.mockRestore();
  });

  it("routes nothing differently without pay several wired in", () => {
    const handlers = createPaymentWebhookHandlers({} as StripePaymentWebhookDeps);
    expect(handlers.paymentIntentSucceeded.constructor.name).toBe("PaymentIntentSucceededHandler");
  });
});
