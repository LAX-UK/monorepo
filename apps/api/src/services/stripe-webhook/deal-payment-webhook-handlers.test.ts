import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { FakeChargeRefunds } from "../../test/fake-charge-refunds.js";
import type { PaymentWebhookHandlers } from "./create-payment-webhook-handlers.js";
import {
  dealChargeRefunded,
  dealPaymentIdOf,
  withDealPaymentHandlers,
} from "./deal-payment-webhook-handlers.js";

const RESULT = { processed: true, action: "skipped" as const };
const event = { id: "evt_1" } as Stripe.Event;
const intent = (metadata: Record<string, string>, extra: object = {}) =>
  ({
    id: "pi_1",
    amount: 4_800_000,
    metadata,
    latest_charge: "ch_1",
    ...extra,
  }) as unknown as Stripe.PaymentIntent;
const session = (metadata: Record<string, string>) =>
  ({ id: "cs_1", metadata }) as unknown as Stripe.Checkout.Session;

function setup() {
  const existing = () => ({ handle: vi.fn(async () => RESULT) });
  const handlers = {
    paymentIntentSucceeded: existing(),
    paymentIntentProcessing: existing(),
    paymentIntentPartiallyFunded: existing(),
    paymentIntentFailed: existing(),
    paymentIntentCanceled: existing(),
    checkoutSessionAsyncPaymentFailed: existing(),
    checkoutSessionExpired: existing(),
  };
  const settlement = {
    settle: vi.fn(async () => RESULT),
    markProcessing: vi.fn(async () => RESULT),
    cancel: vi.fn(async (_input: { reason: string }) => RESULT),
    refunded: vi.fn(async () => RESULT),
  };
  const payments = {
    findByChargeId: vi.fn(async (id: string) => (id === "ch_deal" ? ({} as never) : null)),
  };
  return {
    handlers,
    settlement,
    payments,
    wrapped: withDealPaymentHandlers(handlers as unknown as PaymentWebhookHandlers, {
      settlement,
      payments,
    }),
  };
}

const DEAL_META = { privateSaleDealId: "deal-1", privateSaleDealPaymentId: "pay-1" };

describe("deal payment webhook routing", () => {
  it("reads the deal payment from the checkout metadata", () => {
    expect(dealPaymentIdOf({ metadata: DEAL_META })).toBe("pay-1");
    expect(dealPaymentIdOf({ metadata: { paymentId: "x" } })).toBeNull();
    expect(dealPaymentIdOf({})).toBeNull();
  });

  it("settles a deal's succeeded intent and leaves the lot handler alone", async () => {
    const { wrapped, settlement, handlers } = setup();
    await wrapped.paymentIntentSucceeded.handle(event, intent(DEAL_META));
    expect(settlement.settle).toHaveBeenCalledWith({
      eventId: "evt_1",
      paymentId: "pay-1",
      paymentIntentId: "pi_1",
      chargeId: "ch_1",
      amountMinor: 4_800_000,
    });
    expect(handlers.paymentIntentSucceeded.handle).not.toHaveBeenCalled();
  });

  it("sends every other intent to the existing handlers exactly as before", async () => {
    const { wrapped, settlement, handlers } = setup();
    await wrapped.paymentIntentSucceeded.handle(event, intent({ paymentId: "lot-pay" }));
    await wrapped.paymentIntentCanceled.handle(event, intent({}));
    expect(handlers.paymentIntentSucceeded.handle).toHaveBeenCalledTimes(1);
    expect(handlers.paymentIntentCanceled.handle).toHaveBeenCalledTimes(1);
    expect(settlement.settle).not.toHaveBeenCalled();
    expect(settlement.cancel).not.toHaveBeenCalled();
  });

  it("marks a deal's bank transfer as processing, also when funded in part", async () => {
    const { wrapped, settlement } = setup();
    await wrapped.paymentIntentProcessing.handle(event, intent(DEAL_META));
    await wrapped.paymentIntentPartiallyFunded.handle(event, intent(DEAL_META));
    expect(settlement.markProcessing).toHaveBeenCalledTimes(2);
  });

  it("changes nothing when a deal's attempt fails, so the buyer can try again", async () => {
    const { wrapped, settlement } = setup();
    expect(await wrapped.paymentIntentFailed.handle(event, intent(DEAL_META))).toMatchObject({
      processed: true,
      action: "payment_intent_failed",
    });
    expect(settlement.cancel).not.toHaveBeenCalled();
  });

  it("cancels the payment with the reason each ending gives", async () => {
    const { wrapped, settlement } = setup();
    await wrapped.paymentIntentCanceled.handle(event, intent(DEAL_META));
    await wrapped.checkoutSessionAsyncPaymentFailed.handle(event, session(DEAL_META));
    await wrapped.checkoutSessionExpired.handle(event, session(DEAL_META));
    expect(settlement.cancel.mock.calls.map(([c]) => c.reason)).toEqual([
      "checkout_cancelled",
      "bank_transfer_failed",
      "checkout_expired",
    ]);
  });

  it("records a refund only on a charge that belongs to a deal", async () => {
    const { settlement, payments } = setup();
    const deps = { settlement, payments };
    const other = { id: "ch_lot", amount_refunded: 100 } as Stripe.Charge;
    const refunds = new FakeChargeRefunds();
    // Only the succeeded refund counts; the pending one is left until it succeeds.
    refunds.add({ id: "re_1", chargeId: "ch_deal", amountPence: 4_800_000, status: "succeeded" });
    refunds.add({ id: "re_2", chargeId: "ch_deal", amountPence: 1_000, status: "pending" });
    expect(await dealChargeRefunded(deps, event, other, refunds)).toBeNull();
    const deal = {
      id: "ch_deal",
      amount_refunded: 4_800_000,
      refunds: { data: [{ id: "re_1" }] },
    } as unknown as Stripe.Charge;
    await dealChargeRefunded(deps, event, deal, refunds);
    expect(settlement.refunded).toHaveBeenCalledWith({
      eventId: "evt_1",
      chargeId: "ch_deal",
      refundedMinor: 4_800_000,
      refundId: "re_1",
    });
  });
});
