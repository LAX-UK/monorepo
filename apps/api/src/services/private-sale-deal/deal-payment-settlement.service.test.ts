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

  it("records a full refund made at the provider, and a partial one as the amount returned so far", async () => {
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
    expect(payments.rows[0]).toMatchObject({ status: "paid", refundedMinor: 1_000 });
    expect(events.events.at(-1)).toMatchObject({
      eventType: "private_sale_deal.payment_partly_refunded",
      payload: { refundedMinor: 1_000 },
    });

    // The provider reports the running total, so a larger one moves it up and a repeat is ignored.
    await service.refunded({
      eventId: "r1b",
      chargeId: "ch_1",
      refundedMinor: 2_500,
      refundId: null,
    });
    expect(payments.rows[0]?.refundedMinor).toBe(2_500);
    const repeat = await service.refunded({
      eventId: "r1c",
      chargeId: "ch_1",
      refundedMinor: 2_500,
      refundId: null,
    });
    expect(repeat).toMatchObject({ action: "skipped" });
    expect(payments.rows[0]?.refundedMinor).toBe(2_500);

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

describe("DealPaymentSettlementService receipt", () => {
  it("sends the buyer's receipt once the payment is recorded, and not for a repeat", async () => {
    const receipt = { send: vi.fn(async () => undefined) };
    const { payments, events, transition } = setup();
    const deal = makeDeal();
    const service = new DealPaymentSettlementService({
      transactionRunner: inlineTransactions,
      scopeForTx: () => fakeScope(deal, payments, events),
      transitions: { transition },
      claims: { claim: async (_tx, id) => id !== "dup" },
      receipt,
    });
    await service.settle(paid);
    expect(receipt.send).toHaveBeenCalledWith({ paymentId: "pay-1" });
    await service.settle({ ...paid, eventId: "dup" });
    expect(receipt.send).toHaveBeenCalledTimes(1);
  });

  it("keeps the payment recorded when the receipt cannot be sent", async () => {
    const receipt = {
      send: vi.fn(async () => {
        throw new Error("mail down");
      }),
    };
    const { payments, events, transition } = setup();
    const deal = makeDeal();
    const service = new DealPaymentSettlementService({
      transactionRunner: inlineTransactions,
      scopeForTx: () => fakeScope(deal, payments, events),
      transitions: { transition },
      claims: { claim: async () => true },
      receipt,
    });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await service.settle(paid)).toEqual({
      processed: true,
      action: "payment_intent_succeeded",
    });
    quiet.mockRestore();
    expect(payments.rows[0]?.status).toBe("paid");
  });
});

describe("DealPaymentSettlementService.recordTransferReceived", () => {
  const invoiced = makeDeal({ stage: "invoiced", priceMinor: 4_800_000 });
  const transfer = {
    dealId: "deal-1",
    recordedByUserId: "u-finance",
    bankReference: "FP 4411",
    amountMinor: 4_800_000,
  };

  function transferSetup(
    opts: { rows?: ReturnType<typeof makePayment>[]; transition?: DealTransitionOutcome } = {},
  ) {
    const payments = new InMemoryDealPayments(opts.rows ?? []);
    const events = recordingSink();
    const transition = vi.fn(
      async (): Promise<DealTransitionOutcome> => opts.transition ?? { kind: "ok", deal: invoiced },
    );
    const receipt = { send: vi.fn(async () => undefined) };
    const service = new DealPaymentSettlementService({
      transactionRunner: inlineTransactions,
      scopeForTx: () => fakeScope(invoiced, payments, events),
      transitions: { transition },
      claims: { claim: async () => true },
      receipt,
      now: () => new Date("2026-11-04T09:00:00Z"),
    });
    return { service, payments, events, transition, receipt };
  }

  it("records the transfer as the deal's paid payment, moves the deal to paid and sends the receipt", async () => {
    const { service, payments, events, transition, receipt } = transferSetup();
    const result = await service.recordTransferReceived(transfer);
    expect(result).toMatchObject({ ok: true });
    expect(payments.rows).toHaveLength(1);
    expect(payments.rows[0]).toMatchObject({
      status: "paid",
      rail: "gb_bank_transfer",
      amountMinor: 4_800_000,
      recordedByUserId: "u-finance",
      bankReference: "FP 4411",
      createdByUserId: "u-buyer",
    });
    expect(transition).toHaveBeenCalledWith(
      "deal-1",
      "mark_paid",
      { actorUserId: "u-finance" },
      expect.anything(),
    );
    expect(events.events.map((e) => e.eventType)).toEqual([
      "private_sale_deal.bank_transfer_recorded",
      "private_sale_deal.payment_paid",
    ]);
    expect(receipt.send).toHaveBeenCalledWith({ paymentId: payments.rows[0]?.id });
  });

  it("lets go of the buyer's open checkout when it records the transfer", async () => {
    const { service, payments, events } = transferSetup({
      rows: [makePayment({ status: "open", stripeCheckoutSessionId: "cs_1" })],
    });
    expect(await service.recordTransferReceived(transfer)).toMatchObject({ ok: true });
    expect(payments.rows.map((r) => r.status).sort()).toEqual(["cancelled", "paid"]);
    expect(events.events[0]).toMatchObject({
      eventType: "private_sale_deal.payment_cancelled",
      payload: { reason: "transfer_recorded" },
    });
  });

  it.each([
    ["a different amount", { amountMinor: 4_799_999 }, "amount_mismatch"],
    ["too much", { amountMinor: 4_800_001 }, "amount_mismatch"],
  ])("refuses %s and records nothing", async (_why, change, error) => {
    const { service, payments, transition, receipt } = transferSetup();
    expect(await service.recordTransferReceived({ ...transfer, ...change })).toEqual({
      ok: false,
      error,
    });
    expect(payments.rows).toHaveLength(0);
    expect(transition).not.toHaveBeenCalled();
    expect(receipt.send).not.toHaveBeenCalled();
  });

  it("leaves the buyer's own bank transfer to land instead of recording a second payment", async () => {
    const { service, payments } = transferSetup({ rows: [makePayment({ status: "processing" })] });
    expect(await service.recordTransferReceived(transfer)).toEqual({
      ok: false,
      error: "transfer_in_flight",
    });
    expect(payments.rows).toHaveLength(1);
  });

  it("will not record a second payment for a deal that is paid", async () => {
    const { service, payments } = transferSetup({ rows: [makePayment({ status: "paid" })] });
    expect(await service.recordTransferReceived(transfer)).toEqual({
      ok: false,
      error: "already_paid",
    });
    expect(payments.rows).toHaveLength(1);
  });

  it("cannot be recorded for a deal that is not waiting for payment", async () => {
    const payments = new InMemoryDealPayments();
    const service = new DealPaymentSettlementService({
      transactionRunner: inlineTransactions,
      scopeForTx: () => fakeScope(makeDeal({ stage: "agreed" }), payments, recordingSink()),
      transitions: { transition: vi.fn() },
      claims: { claim: async () => true },
    });
    expect(await service.recordTransferReceived(transfer)).toEqual({
      ok: false,
      error: "not_invoiced",
    });
    expect(payments.rows).toHaveLength(0);
  });

  it("undoes the record when the deal does not move to paid", async () => {
    const { service, receipt } = transferSetup({ transition: { kind: "conflict" } });
    expect(await service.recordTransferReceived(transfer)).toEqual({
      ok: false,
      error: "not_invoiced",
    });
    expect(receipt.send).not.toHaveBeenCalled();
  });
});
