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
import { DealReversalService } from "./deal-reversal.service.js";

const PAID = makePayment({ status: "paid", stripeChargeId: "ch_1", paidAt: new Date() });

function setup(
  over: {
    payments?: ReturnType<typeof makePayment>[];
    payoutLine?: boolean;
    stripe?: boolean;
  } = {},
) {
  const payments = new InMemoryDealPayments(over.payments ?? [PAID]);
  const events = recordingSink();
  const deal = makeDeal({ stage: "paid" });
  const scopeForTx = () => fakeScope(deal, payments, events);
  const settlement = new DealPaymentSettlementService({
    transactionRunner: inlineTransactions,
    scopeForTx,
    transitions: { transition: vi.fn() },
    claims: { claim: async () => true },
  });
  const createRefund = vi.fn(async () => ({ kind: "created" as const, refundId: "re_1" }));
  const expireCheckout = vi.fn(async () => undefined);
  const transition = vi.fn(async () => ({ kind: "ok" as const, deal }));
  const service = new DealReversalService({
    deals: { findById: async () => deal },
    payments,
    payouts: { hasPayoutLine: async () => over.payoutLine ?? false },
    refunds: { isConfigured: () => over.stripe ?? true, createRefund },
    checkout: { expireCheckout },
    settlement,
    transitions: { transition },
    transactionRunner: inlineTransactions,
    scopeForTx,
  });
  return { service, payments, events, createRefund, expireCheckout, transition };
}

describe("DealReversalService.refund", () => {
  it("returns the whole payment through the refund gateway and records it", async () => {
    const { service, payments, createRefund, events } = setup();
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u-fin" })).toEqual({
      ok: true,
      refundedMinor: 4_800_000,
    });
    expect(createRefund).toHaveBeenCalledWith({
      chargeId: "ch_1",
      amount: 4_800_000,
      paymentId: "pay-1",
      reason: "requested_by_customer",
    });
    expect(payments.rows[0]).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
    expect(events.events.at(-1)?.eventType).toBe("private_sale_deal.payment_refunded");
  });

  it("has nothing to return when no payment is paid", async () => {
    const { service, createRefund } = setup({ payments: [makePayment({ status: "open" })] });
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: false,
      error: "nothing_to_refund",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("will not pull money back once the payout includes the deal", async () => {
    const { service, createRefund } = setup({ payoutLine: true });
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: false,
      error: "payout_queued",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("reports when the payment provider is not available", async () => {
    const { service } = setup({ stripe: false });
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: false,
      error: "refund_unavailable",
    });
  });
});

describe("DealReversalService.cancel", () => {
  it("cancels a paid deal only with the refund recorded", async () => {
    const refunded = makePayment({
      status: "refunded",
      refundedMinor: 4_800_000,
      stripeChargeId: "ch_1",
      paidAt: new Date(),
    });
    const { service, transition } = setup({ payments: [refunded] });
    await service.cancel({ dealId: "deal-1", actorUserId: "u", reason: "Buyer withdrew" });
    expect(transition).toHaveBeenCalledWith("deal-1", "cancel", {
      actorUserId: "u",
      cancelReason: "Buyer withdrew",
      refundRecorded: true,
    });
  });

  it("reports no refund while the money is still held", async () => {
    const { service, transition } = setup();
    await service.cancel({ dealId: "deal-1", actorUserId: "u", reason: "x" });
    expect(transition).toHaveBeenCalledWith(
      "deal-1",
      "cancel",
      expect.objectContaining({ refundRecorded: false }),
    );
  });

  it("ends an open checkout first so it cannot be paid afterwards", async () => {
    const open = makePayment({ status: "open", stripeCheckoutSessionId: "cs_1" });
    const { service, expireCheckout, payments } = setup({ payments: [open] });
    await service.cancel({ dealId: "deal-1", actorUserId: "u", reason: "x" });
    expect(expireCheckout).toHaveBeenCalledWith("cs_1");
    expect(payments.rows[0]?.status).toBe("cancelled");
  });

  it("will not cancel while a bank transfer is on its way", async () => {
    const { service, transition } = setup({ payments: [makePayment({ status: "processing" })] });
    expect(await service.cancel({ dealId: "deal-1", actorUserId: "u", reason: "x" })).toEqual({
      kind: "conflict",
    });
    expect(transition).not.toHaveBeenCalled();
  });
});
