import type { IPaymentWriteRepository, PaymentRecord } from "@auction/persistence";
import { describe, expect, it, vi } from "vitest";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
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
    transactionRunner: {
      runInTransaction: vi.fn(async (fn: (t: never) => Promise<void>) => fn(tx)),
    } as never,
    domainEventPublisher: {
      publish: vi.fn().mockResolvedValue(undefined),
    } as unknown as DomainEventPublisher,
    payoutAdjustments: null,
    paymentRefundReconcile: null,
    xeroPaymentRecorder: null,
    ...overrides,
  };
}

describe("executePaymentRefundLedger", () => {
  it("publishes admin_manual refund event without reason key", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
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
      expect.anything(),
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
    expect(publish.mock.calls[0]?.[1]?.payload).not.toHaveProperty("reason");
  });

  it("publishes admin_manual_review refund event with seller_archived reason", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const deps = baseDeps({
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
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
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          via: "admin_manual_review",
          reason: "seller_archived",
        }),
      }),
    );
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
      domainEventPublisher: { publish } as unknown as DomainEventPublisher,
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
});
