import type { Database } from "@auction/db";
import type { UnappliedMoney } from "@auction/domain";
import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
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
    listOpenByChargeId: vi.fn().mockResolvedValue([]),
    listOpen: vi.fn().mockResolvedValue([]),
    findOpen: vi.fn().mockResolvedValue(null),
    isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
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
      },
      recorder: { resolveRefundedCharge: vi.fn() },
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
      },
      recorder: { resolveRefundedCharge },
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
      },
      recorder: { resolveRefundedCharge },
    });
    await expect(handler.handle(event, charge(125000))).resolves.toBeNull();
    expect(resolveRefundedCharge).not.toHaveBeenCalled();
  });

  it("a part refund keeps the task open and still does not touch the invoice", async () => {
    const resolveRefundedCharge = vi.fn();
    const handler = new UnappliedMoneyRefundHandler({
      transactionRunner: runner,
      reader: {
        listOpenByChargeId: vi.fn().mockResolvedValue([{ dedupeKey: "k" }]),
        isChargeOfPaidInvoice: vi.fn().mockResolvedValue(false),
      },
      recorder: { resolveRefundedCharge },
    });
    await expect(handler.handle(event, charge(1000))).resolves.toMatchObject({
      reason: "refunded_in_part",
    });
    expect(resolveRefundedCharge).not.toHaveBeenCalled();
  });
});
