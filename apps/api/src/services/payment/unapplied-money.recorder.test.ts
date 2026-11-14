import type { Database } from "@auction/db";
import type { UnappliedMoney } from "@auction/domain";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { succeededRefunds } from "../../test/fake-charge-refunds.js";
import { UnappliedMoneyRefundHandler } from "../stripe-webhook/unapplied-money-refund.handler.js";
import { NO_UNAPPLIED_MONEY_RECORDER, UnappliedMoneyRecorder } from "./unapplied-money.recorder.js";

vi.mock("../../lib/stripe-processed-event.js", () => ({
  tryClaimProcessedStripeEvent: vi.fn().mockResolvedValue({ claimed: true }),
}));

const tx = {} as Database;
const money: UnappliedMoney = {
  reason: "invoice_already_paid",
  paymentId: "pay-1",
  paymentGroupId: null,
  stripePaymentIntentId: "pi_2",
  stripeChargeId: "ch_2",
  stripeCustomerId: null,
  amountCents: 125000,
  currency: "gbp",
};

function reader(existing: string[] = []) {
  return {
    exists: vi.fn(async (key: string) => existing.includes(key)),
    existsForShopPayment: vi.fn().mockResolvedValue(false),
    listOpenByChargeId: vi.fn().mockResolvedValue([]),
    listOpen: vi.fn().mockResolvedValue([]),
    findOpen: vi.fn().mockResolvedValue(null),
    isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
    wasEverUnapplied: vi.fn().mockResolvedValue(false),
    lockKey: vi.fn().mockResolvedValue(undefined),
  };
}

describe("UnappliedMoneyRecorder", () => {
  it("publishes one event with the dedupe key, an upper-case currency and the payment", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const recorder = new UnappliedMoneyRecorder(reader(), mockDomainEventSink(publish));
    await recorder.record(tx, money, "le-1");
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "payment",
        aggregateId: "pay-1",
        eventType: "payment.unapplied_money_received",
        actingLegalEntityId: "le-1",
        payload: expect.objectContaining({
          dedupeKey: "invoice_already_paid:pi_2",
          currency: "GBP",
          amountCents: 125000,
        }),
      }),
    );
  });

  it("a transfer applied to another invoice is one task per ledger entry: a replay is dropped, a second application is new", async () => {
    const applied: UnappliedMoney = {
      ...money,
      reason: "transfer_applied_to_other_invoice",
      stripeChargeId: null,
      cashBalanceTransactionId: "ccsbtxn_1",
      transferReference: "REF-CANCELLED",
    };
    const publish = vi.fn().mockResolvedValue(undefined);
    const recorder = new UnappliedMoneyRecorder(
      reader(["transfer_applied_to_other_invoice:ccsbtxn_1"]),
      mockDomainEventSink(publish),
    );
    await recorder.record(tx, applied, null);
    expect(publish).not.toHaveBeenCalled();
    await recorder.record(tx, { ...applied, cashBalanceTransactionId: "ccsbtxn_2" }, null);
    expect(publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          dedupeKey: "transfer_applied_to_other_invoice:ccsbtxn_2",
          transferReference: "REF-CANCELLED",
        }),
      }),
    );
  });

  it("does not write the reference a payer quoted to the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const recorder = new UnappliedMoneyRecorder(reader(), mockDomainEventSink(vi.fn()));
    await recorder.record(
      tx,
      { ...money, reason: "transfer_applied_to_other_invoice", transferReference: "REF-1" },
      null,
    );
    expect(String(log.mock.calls[0]?.[0])).not.toContain("REF-1");
    log.mockRestore();
  });

  it("reporting the same money again (a replay or a second cron run) publishes nothing", async () => {
    const publish = vi.fn();
    const recorder = new UnappliedMoneyRecorder(
      reader(["invoice_already_paid:pi_2"]),
      mockDomainEventSink(publish),
    );
    await recorder.record(tx, money, null);
    expect(publish).not.toHaveBeenCalled();
  });

  it("a full refund of the charge closes each open task for it", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const r = reader();
    r.listOpenByChargeId.mockResolvedValue([
      { ...money, dedupeKey: "invoice_already_paid:pi_2", eventId: 7, receivedAt: new Date() },
    ]);
    await new UnappliedMoneyRecorder(r, mockDomainEventSink(publish)).resolveRefundedCharge(
      tx,
      "ch_2",
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.unapplied_money_resolved",
        payload: {
          dedupeKey: "invoice_already_paid:pi_2",
          stripeChargeId: "ch_2",
          via: "charge_refunded",
        },
      }),
    );
  });

  it("capture closes a paid-not-recorded task for the same intent or charge", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const r = reader();
    r.listOpen.mockResolvedValue([
      {
        ...money,
        reason: "paid_not_recorded",
        dedupeKey: "paid_not_recorded:pi_2",
        eventId: 9,
        receivedAt: new Date(),
      },
    ]);
    await new UnappliedMoneyRecorder(r, mockDomainEventSink(publish)).resolveApplied(tx, {
      paymentIntentId: "pi_2",
      chargeId: "ch_2",
    });
    expect(r.listOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: "pi_2",
        chargeId: "ch_2",
        reasons: ["paid_not_recorded", "invoice_cancelled"],
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.unapplied_money_resolved",
        payload: { dedupeKey: "paid_not_recorded:pi_2", via: "captured" },
      }),
    );
  });

  it("takes a per-key lock and checks for an earlier report inside the transaction", async () => {
    const r = reader();
    await new UnappliedMoneyRecorder(r, mockDomainEventSink()).record(tx, money, null);
    expect(r.lockKey).toHaveBeenCalledWith(tx, "invoice_already_paid:pi_2");
    expect(r.exists).toHaveBeenCalledWith("invoice_already_paid:pi_2", tx);
    expect(r.lockKey.mock.invocationCallOrder[0]).toBeLessThan(
      r.exists.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("a new report of a customer's balance replaces the earlier open ones", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const r = reader();
    const earlier = {
      ...money,
      reason: "customer_balance_unapplied" as const,
      paymentId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeCustomerId: "cus_1",
      dedupeKey: "customer_balance_unapplied:evt_1:gbp",
      eventId: 3,
      receivedAt: new Date(),
    };
    r.listOpen.mockResolvedValue([earlier]);
    await new UnappliedMoneyRecorder(r, mockDomainEventSink(publish)).record(
      tx,
      { ...earlier, stripeEventId: "evt_2:gbp", amountCents: 50_000 },
      null,
    );
    expect(r.lockKey).toHaveBeenCalledWith(tx, "customer:cus_1");
    expect(r.listOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        reasons: ["customer_balance_unapplied"],
        stripeCustomerId: "cus_1",
        currency: "GBP",
      }),
      tx,
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.unapplied_money_resolved",
        payload: { dedupeKey: "customer_balance_unapplied:evt_1:gbp", via: "superseded" },
      }),
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "payment.unapplied_money_received" }),
    );
  });

  it("a paid-twice report for an intent closes its open part-transfer task as superseded", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const r = reader();
    const partial = {
      ...money,
      reason: "transfer_partially_funded_after_paid" as const,
      dedupeKey: "transfer_partially_funded_after_paid:pi_2",
      eventId: 4,
      receivedAt: new Date(),
    };
    r.listOpen.mockResolvedValue([partial]);

    await new UnappliedMoneyRecorder(r, mockDomainEventSink(publish)).record(tx, money, null);

    expect(r.listOpen).toHaveBeenCalledWith(
      expect.objectContaining({
        reasons: ["transfer_partially_funded_after_paid"],
        paymentIntentId: "pi_2",
      }),
      tx,
    );
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.unapplied_money_resolved",
        payload: { dedupeKey: partial.dedupeKey, via: "superseded" },
      }),
    );
  });

  it("a part-transfer report supersedes nothing", async () => {
    const r = reader();
    await new UnappliedMoneyRecorder(r, mockDomainEventSink(vi.fn())).record(
      tx,
      { ...money, reason: "transfer_partially_funded_after_paid" },
      null,
    );
    expect(r.listOpen).not.toHaveBeenCalled();
  });

  it("a balance report in one currency only looks for that currency's open tasks", async () => {
    const r = reader();
    const balance = {
      ...money,
      reason: "customer_balance_unapplied" as const,
      paymentId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      stripeCustomerId: "cus_1",
    };
    const recorder = new UnappliedMoneyRecorder(r, mockDomainEventSink(vi.fn()));
    await recorder.record(tx, { ...balance, stripeEventId: "evt_1:gbp", currency: "gbp" }, null);
    await recorder.record(tx, { ...balance, stripeEventId: "evt_1:eur", currency: "eur" }, null);
    expect(r.listOpen.mock.calls.map((c) => c[0].currency)).toEqual(["GBP", "EUR"]);
  });

  it("an unwired recorder fails loudly, so money is never dropped", async () => {
    await expect(NO_UNAPPLIED_MONEY_RECORDER.record(tx, money, null)).rejects.toThrow(
      "unapplied_money_recorder_not_configured",
    );
  });
});

describe("UnappliedMoneyRefundHandler", () => {
  const runner = {
    runInTransaction: async (fn: (t: Database) => Promise<unknown>) => fn(tx),
  } as never;
  const charge = (refunded: number) =>
    ({ id: "ch_2", amount: 125000, amount_refunded: refunded }) as Stripe.Charge;
  const event = { id: "evt_refund" } as Stripe.Event;

  it("leaves an invoice's own charge to the normal refund handling", async () => {
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
        wasEverUnapplied: vi.fn().mockResolvedValue(false),
      },
      recorder: { resolveRefundedCharge: vi.fn() },
      chargeRefunds: succeededRefunds(125000),
    });
    await expect(handler.handle(event, charge(125000))).resolves.toBeNull();
  });

  it("takes a refund of unapplied money away from the invoice and closes the task", async () => {
    const resolveRefundedCharge = vi.fn().mockResolvedValue(undefined);
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([{ dedupeKey: "k" }]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
        wasEverUnapplied: vi.fn().mockResolvedValue(true),
      },
      recorder: { resolveRefundedCharge },
      chargeRefunds: succeededRefunds(125000),
    });
    await expect(handler.handle(event, charge(125000))).resolves.toEqual({
      processed: true,
      action: "unapplied_money_refunded",
      reason: "refunded_in_full",
    });
    expect(resolveRefundedCharge).toHaveBeenCalledWith(tx, "ch_2");
  });

  it("a refund of a paid invoice's own charge goes to the invoice's refund handling", async () => {
    const resolveRefundedCharge = vi.fn();
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([{ dedupeKey: "k" }]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(true),
        wasEverUnapplied: vi.fn().mockResolvedValue(true),
      },
      recorder: { resolveRefundedCharge },
      chargeRefunds: succeededRefunds(125000),
    });
    await expect(handler.handle(event, charge(125000))).resolves.toBeNull();
    expect(resolveRefundedCharge).not.toHaveBeenCalled();
  });

  it("a charge whose task was closed (marked handled) still never takes the invoice path", async () => {
    const resolveRefundedCharge = vi.fn();
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
        wasEverUnapplied: vi.fn().mockResolvedValue(true),
      },
      recorder: { resolveRefundedCharge },
      chargeRefunds: succeededRefunds(125000),
    });
    await expect(handler.handle(event, charge(125000))).resolves.toMatchObject({
      processed: true,
      action: "unapplied_money_refunded",
    });
  });

  it("a part refund keeps the task open and still does not touch the invoice", async () => {
    const resolveRefundedCharge = vi.fn();
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([{ dedupeKey: "k" }]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
        wasEverUnapplied: vi.fn().mockResolvedValue(true),
      },
      recorder: { resolveRefundedCharge },
      chargeRefunds: succeededRefunds(1000),
    });
    await expect(handler.handle(event, charge(1000))).resolves.toMatchObject({
      reason: "refunded_in_part",
    });
    expect(resolveRefundedCharge).not.toHaveBeenCalled();
  });

  it("asks whether the charge was ever unapplied by its charge id and its payment intent", async () => {
    const wasEverUnapplied = vi.fn().mockResolvedValue(true);
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
        wasEverUnapplied,
      },
      recorder: { resolveRefundedCharge: vi.fn() },
      chargeRefunds: succeededRefunds(125000),
    });
    const withIntent = { ...charge(125000), payment_intent: "pi_2" } as Stripe.Charge;
    await handler.handle(event, withIntent);
    expect(wasEverUnapplied).toHaveBeenCalledWith({ chargeId: "ch_2", paymentIntentId: "pi_2" });
  });

  it("asks whether the charge pays an invoice by its charge id and its payment intent", async () => {
    const isChargeOfPaidInvoice = vi.fn().mockResolvedValue(true);
    const wasEverUnapplied = vi.fn().mockResolvedValue(true);
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([]),
        isChargeOfPaidInvoice,
        wasEverUnapplied,
      },
      recorder: { resolveRefundedCharge: vi.fn() },
      chargeRefunds: succeededRefunds(125000),
    });
    const withIntent = { ...charge(125000), payment_intent: { id: "pi_2" } } as Stripe.Charge;
    // The invoice matched by intent wins over a task that carries the same intent.
    await expect(handler.handle(event, withIntent)).resolves.toBeNull();
    expect(isChargeOfPaidInvoice).toHaveBeenCalledWith({
      chargeId: "ch_2",
      paymentIntentId: "pi_2",
    });
    expect(wasEverUnapplied).not.toHaveBeenCalled();
  });
});
