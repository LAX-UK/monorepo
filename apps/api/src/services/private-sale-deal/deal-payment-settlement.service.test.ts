import { describe, expect, it, vi } from "vitest";
import {
  InMemoryDealPayments,
  fakeScope,
  inlineTransactions,
  makeDeal,
  makePayment,
  recordingSink,
} from "./deal-fixtures.test-util.js";
import { DealPaymentSettlementService } from "./deal-payment-settlement.service.js";
import type { DealTransitionOutcome } from "./deal-transition.service.js";

function setup(
  opts: { status?: "open" | "processing" | "paid"; transition?: DealTransitionOutcome } = {},
) {
  const payments = new InMemoryDealPayments([makePayment({ status: opts.status ?? "open" })]);
  const events = recordingSink();
  const deal = makeDeal();
  const seen = new Set<string>();
  const transition = vi.fn(
    async (): Promise<DealTransitionOutcome> => opts.transition ?? { kind: "ok", deal },
  );
  const service = new DealPaymentSettlementService({
    transactionRunner: inlineTransactions,
    scopeForTx: () => fakeScope(deal, payments, events),
    transitions: { transition },
    claims: {
      claim: async (_tx, id) => {
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      },
    },
    now: () => new Date("2026-11-04T09:00:00Z"),
  });
  return { service, payments, events, transition };
}

const paid = {
  eventId: "evt_1",
  paymentId: "pay-1",
  paymentIntentId: "pi_1",
  chargeId: "ch_1",
  amountMinor: 4_800_000,
};

describe("DealPaymentSettlementService.settle", () => {
  it("marks the payment paid, moves the deal to paid and publishes the payment", async () => {
    const { service, payments, events, transition } = setup();
    const result = await service.settle(paid);
    expect(result).toEqual({ processed: true, action: "payment_intent_succeeded" });
    expect(payments.rows[0]).toMatchObject({ status: "paid", stripeChargeId: "ch_1" });
    expect(transition).toHaveBeenCalledWith(
      "deal-1",
      "mark_paid",
      { actorUserId: null },
      expect.anything(),
    );
    expect(events.events).toEqual([
      {
        eventType: "private_sale_deal.payment_paid",
        payload: {
          dealId: "deal-1",
          reference: "PS-0001",
          paymentId: "pay-1",
          amountMinor: 4_800_000,
        },
      },
    ]);
  });

  it("is idempotent: a redelivered event changes nothing", async () => {
    const { service, transition, events } = setup();
    await service.settle(paid);
    const again = await service.settle(paid);
    expect(again).toMatchObject({ processed: false, reason: "duplicate_event" });
    expect(transition).toHaveBeenCalledTimes(1);
    expect(events.events).toHaveLength(1);
  });

  it("does not pay twice when a second event arrives for a paid payment", async () => {
    const { service, transition } = setup({ status: "paid" });
    const result = await service.settle({ ...paid, eventId: "evt_2" });
    expect(result).toMatchObject({ reason: "payment_not_open" });
    expect(transition).not.toHaveBeenCalled();
  });

  it("refuses an amount that differs from what the checkout charged", async () => {
    const { service, payments } = setup();
    const result = await service.settle({ ...paid, amountMinor: 100 });
    expect(result).toMatchObject({ processed: false, reason: "amount_mismatch" });
    expect(payments.rows[0]?.status).toBe("open");
  });

  it("keeps the money recorded when the deal was no longer waiting for it", async () => {
    const { service, payments } = setup({ transition: { kind: "blocked", blockers: [] } });
    const result = await service.settle(paid);
    expect(result).toMatchObject({ processed: true, reason: "deal_not_invoiced" });
    expect(payments.rows[0]?.status).toBe("paid");
  });

  it("skips a payment it does not know", async () => {
    const { service } = setup();
    expect(await service.settle({ ...paid, paymentId: "nope" })).toMatchObject({
      reason: "private_sale_payment_not_found",
    });
  });
});

describe("DealPaymentSettlementService other events", () => {
  it("marks a bank transfer as processing once", async () => {
    const { service, payments } = setup();
    expect(await service.markProcessing({ eventId: "e1", paymentId: "pay-1" })).toMatchObject({
      action: "payment_intent_processing",
    });
    expect(payments.rows[0]?.status).toBe("processing");
    expect(await service.markProcessing({ eventId: "e1", paymentId: "pay-1" })).toMatchObject({
      reason: "duplicate_event",
    });
  });

  it("cancels an open checkout and publishes why", async () => {
    const { service, payments, events } = setup();
    await service.cancel({ eventId: "e2", paymentId: "pay-1", reason: "checkout_expired" });
    expect(payments.rows[0]?.status).toBe("cancelled");
    expect(events.events[0]).toMatchObject({
      eventType: "private_sale_deal.payment_cancelled",
      payload: { reason: "checkout_expired" },
    });
  });

  it("never cancels a payment that is already paid", async () => {
    const { service, payments } = setup({ status: "paid" });
    const result = await service.cancel({
      eventId: "e3",
      paymentId: "pay-1",
      reason: "checkout_expired",
    });
    expect(result).toMatchObject({ reason: "payment_not_open" });
    expect(payments.rows[0]?.status).toBe("paid");
  });

  it("records a full refund made at the provider, and leaves a partial one for finance", async () => {
    const { service, payments, events } = setup({ status: "paid" });
    payments.rows = payments.rows.map((r) => ({
      ...r,
      stripeChargeId: "ch_1",
      paidAt: new Date(),
    }));

    const partial = await service.refunded({
      eventId: "r1",
      chargeId: "ch_1",
      refundedMinor: 1_000,
      refundId: "re_1",
    });
    expect(partial).toMatchObject({ reason: "partial_refund" });
    expect(payments.rows[0]?.status).toBe("paid");

    const full = await service.refunded({
      eventId: "r2",
      chargeId: "ch_1",
      refundedMinor: 4_800_000,
      refundId: "re_2",
    });
    expect(full).toEqual({ processed: true, action: "refund_received" });
    expect(payments.rows[0]).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
    expect(events.events.at(-1)?.eventType).toBe("private_sale_deal.payment_refunded");
  });
});
