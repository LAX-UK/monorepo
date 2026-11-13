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
    /** The answer to each look at the payout, in order; the last answer repeats. */
    payoutLooks?: boolean[];
    stripe?: boolean;
    /** The status Stripe gives the refund it creates. */
    refundStatus?: string;
  } = {},
) {
  const looks = [...(over.payoutLooks ?? [])];
  const hasPayoutLine = vi.fn(async () =>
    looks.length > 1 ? (looks.shift() as boolean) : (looks[0] ?? over.payoutLine ?? false),
  );
  const unapplied = vi.fn(
    async (_tx: unknown, _money: Record<string, unknown>, _le?: unknown) => {},
  );
  const payments = new InMemoryDealPayments(over.payments ?? [PAID]);
  const events = recordingSink();
  const deal = makeDeal({ stage: "paid" });
  const scopeForTx = () => fakeScope(deal, payments, events);
  const settlement = new DealPaymentSettlementService({
    unappliedMoney: { record: unapplied },
    payouts: { hasPayoutLine },
    transactionRunner: inlineTransactions,
    scopeForTx,
    transitions: { transition: vi.fn() },
    claims: { claim: async () => true },
  });
  const createRefund = vi.fn(async (input: { sequence?: number; amount?: number }) => ({
    kind: "created" as const,
    refundId: "re_1",
    status: over.refundStatus ?? "succeeded",
    amountPence: input.amount ?? 0,
  }));
  const watch = vi.fn(async () => undefined);
  const expireCheckout = vi.fn(async () => undefined);
  const transition = vi.fn(async () => ({ kind: "ok" as const, deal }));
  const service = new DealReversalService({
    deals: { findById: async () => deal },
    payments,
    payouts: { hasPayoutLine },
    refunds: { isConfigured: () => over.stripe ?? true, createRefund },
    checkout: { expireCheckout },
    settlement,
    transitions: { transition },
    transactionRunner: inlineTransactions,
    scopeForTx,
    refundWatch: { watch },
  });
  return { service, payments, events, createRefund, expireCheckout, transition, unapplied, watch };
}

describe("DealReversalService.refund", () => {
  it("returns the whole payment through the refund gateway and records it", async () => {
    const { service, payments, createRefund, events } = setup();
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u-fin" })).toEqual({
      ok: true,
      refundedMinor: 4_800_000,
      remainingMinor: 0,
    });
    expect(createRefund).toHaveBeenCalledWith({
      chargeId: "ch_1",
      amount: 4_800_000,
      paymentId: "pay-1",
      sequence: 0,
      reason: "requested_by_customer",
    });
    expect(payments.rows[0]).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
    expect(events.events.at(-1)?.eventType).toBe("private_sale_deal.payment_refunded");
  });

  it("returns part of the payment and leaves it paid with the amount recorded", async () => {
    const { service, payments, createRefund, events } = setup();
    expect(
      await service.refund({ dealId: "deal-1", actorUserId: "u-fin", amountMinor: 100_000 }),
    ).toEqual({ ok: true, refundedMinor: 100_000, remainingMinor: 4_700_000 });
    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 100_000, sequence: 0 }),
    );
    expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 100_000 });
    expect(events.events.at(-1)).toMatchObject({
      eventType: "private_sale_deal.payment_partly_refunded",
      payload: { paymentId: "pay-1", amountMinor: 4_800_000, refundedMinor: 100_000 },
    });
  });

  it("makes a second part refund of the same size a refund of its own", async () => {
    const { service, payments, createRefund } = setup();
    await service.refund({ dealId: "deal-1", actorUserId: "u", amountMinor: 100_000 });
    await service.refund({ dealId: "deal-1", actorUserId: "u", amountMinor: 100_000 });
    expect(createRefund.mock.calls.map(([call]) => call.sequence)).toEqual([0, 100_000]);
    expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 200_000 });
  });

  it("returns only what is left when the rest is refunded after a part refund", async () => {
    const part = makePayment({
      status: "paid",
      stripeChargeId: "ch_1",
      paidAt: new Date(),
      refundedMinor: 1_000_000,
    });
    const { service, payments, createRefund } = setup({ payments: [part] });
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: true,
      refundedMinor: 3_800_000,
      remainingMinor: 0,
    });
    expect(createRefund).toHaveBeenCalledWith(expect.objectContaining({ amount: 3_800_000 }));
    expect(payments.rows[0]).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
  });

  it.each([0, -5, 1.5, 4_800_001])("refuses an amount of %s", async (amountMinor) => {
    const { service, createRefund } = setup();
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u", amountMinor })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(createRefund).not.toHaveBeenCalled();
  });

  it("has nothing to return when the payment is already fully refunded", async () => {
    const { service } = setup({
      payments: [makePayment({ status: "paid", stripeChargeId: "ch_1", refundedMinor: 4_800_000 })],
    });
    expect(await service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: false,
      error: "nothing_to_refund",
    });
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

  it.each(["pending", "requires_action"])(
    "records nothing while Stripe's refund is %s, and watches it until it is final",
    async (refundStatus) => {
      const { service, payments, events, watch } = setup({ refundStatus });
      const before = events.events.length;
      expect(await service.refund({ dealId: "deal-1", actorUserId: "u-fin" })).toEqual({
        ok: true,
        refundedMinor: 4_800_000,
        remainingMinor: 0,
        pendingAtProvider: true,
      });
      expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 0 });
      expect(events.events).toHaveLength(before);
      expect(watch).toHaveBeenCalledWith([
        expect.objectContaining({
          stripeRefundId: "re_1",
          stripeChargeId: "ch_1",
          status: refundStatus,
          amountPence: 4_800_000,
        }),
      ]);
    },
  );

  it.each(["failed", "canceled"])(
    "records nothing and reports the refund could not be made when Stripe's refund is %s",
    async (refundStatus) => {
      const { service, payments, watch } = setup({ refundStatus });
      expect(await service.refund({ dealId: "deal-1", actorUserId: "u-fin" })).toEqual({
        ok: false,
        error: "refund_unavailable",
      });
      expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 0 });
      expect(watch).not.toHaveBeenCalled();
    },
  );

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

describe("DealReversalService.recordBankRefund", () => {
  const TRANSFER = makePayment({
    status: "paid",
    rail: "gb_bank_transfer",
    paidAt: new Date(),
    recordedByUserId: "u-finance",
    bankReference: "FP 4411",
  });
  const refund = {
    dealId: "deal-1",
    actorUserId: "u-fin",
    amountMinor: 100_000,
    bankReference: "BACS 77",
  };

  it("records money returned by bank as part of the total, and leaves the payment paid", async () => {
    const { service, payments, events, createRefund } = setup({ payments: [TRANSFER] });
    expect(await service.recordBankRefund(refund)).toEqual({
      ok: true,
      refundedMinor: 100_000,
      remainingMinor: 4_700_000,
    });
    expect(createRefund).not.toHaveBeenCalled();
    expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 100_000 });
    expect(events.events.map((e) => e.eventType)).toEqual([
      "private_sale_deal.payment_partly_refunded",
      "private_sale_deal.bank_refund_recorded",
    ]);
    expect(events.events.at(-1)?.payload).toMatchObject({
      paymentId: "pay-1",
      amountMinor: 100_000,
      refundedMinor: 100_000,
      bankReference: "BACS 77",
    });
  });

  it("closes the payment as refunded once all of it has gone back, so the deal can be cancelled", async () => {
    const { service, payments, events } = setup({ payments: [TRANSFER] });
    await service.recordBankRefund({ ...refund, amountMinor: 4_700_000 });
    await service.recordBankRefund({ ...refund, amountMinor: 100_000, bankReference: "BACS 78" });
    expect(payments.rows[0]).toMatchObject({ status: "refunded", refundedMinor: 4_800_000 });
    expect(
      events.events.filter((e) => e.eventType === "private_sale_deal.bank_refund_recorded"),
    ).toHaveLength(2);
    expect(events.events.some((e) => e.eventType === "private_sale_deal.payment_refunded")).toBe(
      true,
    );
  });

  it("records the actor with the audit event", async () => {
    const { service, events } = setup({ payments: [TRANSFER] });
    await service.recordBankRefund(refund);
    expect(events.actors.at(-1)).toBe("u-fin");
  });

  it.each([0, -1, 1.5, 4_800_001])("refuses an amount of %s", async (amountMinor) => {
    const { service, payments } = setup({ payments: [TRANSFER] });
    expect(await service.recordBankRefund({ ...refund, amountMinor })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(payments.rows[0]?.refundedMinor).toBe(0);
  });

  it("will not return more than was paid, even when two people record at once", async () => {
    const { service, payments } = setup({ payments: [TRANSFER] });
    await service.recordBankRefund({ ...refund, amountMinor: 4_000_000 });
    expect(await service.recordBankRefund({ ...refund, amountMinor: 4_000_000 })).toEqual({
      ok: false,
      error: "invalid_amount",
    });
    expect(payments.rows[0]?.refundedMinor).toBe(4_000_000);
  });

  it("is only for a payment finance recorded by hand, and the Stripe refund is not for one", async () => {
    const card = setup();
    expect(await card.service.recordBankRefund(refund)).toEqual({
      ok: false,
      error: "not_a_recorded_transfer",
    });
    const transfer = setup({ payments: [TRANSFER] });
    expect(await transfer.service.refund({ dealId: "deal-1", actorUserId: "u" })).toEqual({
      ok: false,
      error: "bank_transfer_payment",
    });
    expect(transfer.createRefund).not.toHaveBeenCalled();
  });

  it("will not record a refund once the payout includes the deal, or when nothing is paid", async () => {
    const queued = setup({ payments: [TRANSFER], payoutLine: true });
    expect(await queued.service.recordBankRefund(refund)).toEqual({
      ok: false,
      error: "payout_queued",
    });
    const unpaid = setup({ payments: [makePayment({ status: "open" })] });
    expect(await unpaid.service.recordBankRefund(refund)).toEqual({
      ok: false,
      error: "nothing_to_refund",
    });
  });

  it("looks at the payout again under the payment's lock: one queued in between is refused", async () => {
    // Clear when first looked at, queued by the time the payment is held.
    const { service, payments, events } = setup({
      payments: [TRANSFER],
      payoutLooks: [false, true],
    });
    expect(await service.recordBankRefund(refund)).toEqual({ ok: false, error: "payout_queued" });
    expect(payments.rows[0]?.refundedMinor).toBe(0);
    expect(events.events).toEqual([]);
  });

  it("tells finance the seller's payout may need adjusting when it is queued while the refund is recorded", async () => {
    // Clear at both looks before the record, queued by the time it is made.
    const { service, payments, unapplied } = setup({
      payments: [TRANSFER],
      payoutLooks: [false, false, true],
    });
    expect(await service.recordBankRefund(refund)).toMatchObject({ ok: true });
    expect(payments.rows[0]?.refundedMinor).toBe(100_000);
    expect(unapplied).toHaveBeenCalledTimes(1);
    expect(unapplied.mock.calls[0]?.[1]).toMatchObject({
      reason: "private_sale_refund_after_payout",
      stripeEventId: "bank_refund:pay-1:100000",
      privateSaleDealId: "deal-1",
      privateSaleDealPaymentId: "pay-1",
      amountCents: 100_000,
    });
  });

  it("raises no alert when the payout never included the deal", async () => {
    const { service, unapplied } = setup({ payments: [TRANSFER] });
    await service.recordBankRefund(refund);
    expect(unapplied).not.toHaveBeenCalled();
  });
});
