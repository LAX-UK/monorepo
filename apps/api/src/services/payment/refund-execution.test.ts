import type { IPaymentWriteRepository, PaymentRecord } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { mockDomainEventSink } from "../../test/domain-event-sink-mock.js";
import { InMemoryPaymentRefunds } from "../../test/in-memory-payment-refunds.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { PaymentRefundReconcileService } from "./payment-refund-reconcile.service.js";
import { type RefundLedgerDeps, executePaymentRefundLedger } from "./refund-execution.js";

const payment: PaymentRecord = {
  id: "pay-1",
  lotId: "lot-1",
  paidByUserId: "buyer-1",
  buyerLegalEntityId: "le-buyer",
  sellerLegalEntityId: "le-seller",
  amount: "100.00",
  platformFee: "5.00",
  status: "captured",
  stripePaymentIntentId: null,
  stripeChargeId: "ch_1",
  stripeRefundId: null,
  createdAt: new Date(),
};

function baseDeps(overrides: Partial<RefundLedgerDeps> = {}): RefundLedgerDeps {
  const tx = {} as never;
  return {
    payments: {
      applyRefundedInTransaction: vi.fn().mockResolvedValue(true),
    } as unknown as IPaymentWriteRepository,
    paymentRefunds: new InMemoryPaymentRefunds(),
    transactionRunner: {
      runInTransaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)),
    } as never,
    domainEventSink: mockDomainEventSink(vi.fn().mockResolvedValue(undefined)),
    payoutAdjustments: null,
    paymentRefundReconcile: null,
    xeroPaymentRecorder: null,
    ...overrides,
  };
}

/** The in-memory record baseDeps wires in. */
const refundsOf = (deps: RefundLedgerDeps) => deps.paymentRefunds as InMemoryPaymentRefunds;

describe("executePaymentRefundLedger", () => {
  it("publishes admin_manual refund event without reason key", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });

    const result = await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual",
      sourceEventId: "admin_refund:pay-1",
      clawbackNote: "Admin refund: pay-1",
      logViaField: false,
    });

    expect(result.isOk()).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "payment.refunded",
        payload: {
          amount: "100.00",
          currency: "GBP",
          sellerLegalEntityId: "le-seller",
          via: "admin_manual",
          stripeRefundId: "re_1",
        },
      }),
    );
    expect(publish.mock.calls[0]?.[0]?.payload).not.toHaveProperty("reason");
  });

  it("publishes admin_manual_review refund event with seller_archived reason", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });

    const result = await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual_review",
      eventReason: "seller_archived",
      sourceEventId: "admin_manual_review_refund:pay-1",
      clawbackNote: "Manual review refund: pay-1",
      logViaField: true,
    });

    expect(result.isOk()).toBe(true);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          via: "admin_manual_review",
          reason: "seller_archived",
        }),
      }),
    );
  });

  it("keeps the staff member's written reason and the actor on a manual-review refund event", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });

    await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual_review",
      eventReason: "seller_archived",
      staffReason: "Seller archived before capture; buyer asked for the money back.",
      sourceEventId: "admin_manual_review_refund:pay-1",
      clawbackNote: "Manual review refund: pay-1",
      logViaField: true,
    });

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-1",
        payload: expect.objectContaining({
          staffReason: "Seller archived before capture; buyer asked for the money back.",
        }),
      }),
    );
  });

  it("omits the staff reason when none is given", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });

    await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual",
      sourceEventId: "admin_refund:pay-1",
      clawbackNote: "Admin refund: pay-1",
      logViaField: false,
    });

    expect(publish.mock.calls[0]?.[0]?.payload).not.toHaveProperty("staffReason");
  });

  it("creates payout clawback with caller-provided sourceEventId and note", async () => {
    const addClawback = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      payoutAdjustments: {
        addPaymentLineToOpenPayoutOrCreateClawback: addClawback,
      } as unknown as IPayoutAdjustmentService,
    });

    await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual",
      sourceEventId: "admin_refund:pay-1",
      clawbackNote: "Admin refund: pay-1",
      logViaField: false,
    });

    expect(addClawback).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEventId: "admin_refund:pay-1",
        note: "Admin refund: pay-1",
        amount: "-100.00",
      }),
    );
  });

  it("enqueues reconcile and returns error when persist fails", async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = baseDeps({
      transactionRunner: {
        runInTransaction: vi.fn().mockRejectedValue(new Error("tx failed")),
      } as never,
      paymentRefundReconcile: { enqueue } as unknown as PaymentRefundReconcileService,
    });

    const result = await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual_review",
      eventReason: "seller_archived",
      sourceEventId: "admin_manual_review_refund:pay-1",
      clawbackNote: "Manual review refund: pay-1",
      logViaField: true,
    });

    expect(result.isErr()).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentId: "pay-1",
        payload: expect.objectContaining({ via: "admin_manual_review" }),
      }),
    );
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"via":"admin_manual_review"'));
    consoleSpy.mockRestore();
  });

  it("no-ops inside transaction when payment already refunded", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      payments: {
        applyRefundedInTransaction: vi.fn().mockResolvedValue(false),
      } as unknown as IPaymentWriteRepository,
      domainEventSink: mockDomainEventSink(publish) as unknown as IDomainEventSink,
    });

    const result = await executePaymentRefundLedger(deps, {
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1",
      via: "admin_manual",
      sourceEventId: "admin_refund:pay-1",
      clawbackNote: "Admin refund: pay-1",
      logViaField: false,
    });

    expect(result.isOk()).toBe(true);
    expect(publish).not.toHaveBeenCalled();
  });

  describe("the buyer-side refund record", () => {
    const input = (over: Partial<Parameters<typeof executePaymentRefundLedger>[1]> = {}) => ({
      payment,
      adminUserId: "admin-1",
      stripeRefundId: "re_1" as string | null,
      via: "admin_manual" as const,
      sourceEventId: "admin_refund:pay-1",
      clawbackNote: "Admin refund: pay-1",
      logViaField: false,
      ...over,
    });

    it("records the whole payment as refunded, keyed like its payout line, with the Stripe refund id kept", async () => {
      const deps = baseDeps();
      await executePaymentRefundLedger(deps, input());
      expect(refundsOf(deps).entries).toEqual([
        {
          paymentId: "pay-1",
          idempotencyKey: "admin_refund:pay-1",
          stripeRefundId: "re_1",
          amountPence: 10_000,
          currency: "GBP",
          source: "staff",
        },
      ]);
    });

    it("keys the record by the source event id when Stripe gave no refund id", async () => {
      const deps = baseDeps();
      await executePaymentRefundLedger(deps, input({ stripeRefundId: null }));
      expect(refundsOf(deps).entries.map((e) => e.idempotencyKey)).toEqual(["admin_refund:pay-1"]);
    });

    it("records the refund of a payment with no seller, which has no payout line to reverse", async () => {
      const addLine = vi.fn();
      const deps = baseDeps({
        payoutAdjustments: {
          addPaymentLineToOpenPayoutOrCreateClawback: addLine,
        } as unknown as IPayoutAdjustmentService,
      });
      const noSeller = { ...payment, sellerLegalEntityId: null } as unknown as PaymentRecord;
      const result = await executePaymentRefundLedger(deps, input({ payment: noSeller }));
      expect(result.isOk()).toBe(true);
      expect(addLine).not.toHaveBeenCalled();
      expect(await refundsOf(deps).sumRefundedPence("pay-1")).toEqual({
        pence: 10_000,
        otherCurrencies: [],
      });
    });

    it("records the refund when there is no payout adjustment service at all", async () => {
      const deps = baseDeps({ payoutAdjustments: null });
      await executePaymentRefundLedger(deps, input());
      expect((await refundsOf(deps).sumRefundedPence("pay-1")).pence).toBe(10_000);
    });

    it("records a refund once when the same one is reported again", async () => {
      const deps = baseDeps();
      await executePaymentRefundLedger(deps, input());
      await executePaymentRefundLedger(deps, input());
      expect(refundsOf(deps).entries).toHaveLength(1);
      expect((await refundsOf(deps).sumRefundedPence("pay-1")).pence).toBe(10_000);
    });

    it("locks the payment before it applies the refund and records it", async () => {
      const deps = baseDeps();
      await executePaymentRefundLedger(deps, input());
      expect(refundsOf(deps).calls).toEqual(["lock:pay-1", "record:pay-1"]);
    });

    it("records nothing for a payment that was already refunded", async () => {
      const deps = baseDeps({
        payments: {
          applyRefundedInTransaction: vi.fn().mockResolvedValue(false),
        } as unknown as IPaymentWriteRepository,
      });
      await executePaymentRefundLedger(deps, input());
      expect(refundsOf(deps).entries).toEqual([]);
    });

    it("records it in the transaction that publishes the event", async () => {
      const order: string[] = [];
      const deps = baseDeps({
        paymentRefunds: {
          recordInTransaction: vi.fn(async () => {
            order.push("record");
            return true;
          }),
          lockPaymentInTransaction: vi.fn(async () => {
            order.push("lock");
            return true;
          }),
          sumRefundedPenceInTransaction: vi.fn(),
        },
        domainEventSink: mockDomainEventSink(
          vi.fn(async () => {
            order.push("publish");
          }),
        ) as unknown as IDomainEventSink,
      });
      await executePaymentRefundLedger(deps, input());
      expect(order).toEqual(["lock", "record", "publish"]);
    });
  });
});
