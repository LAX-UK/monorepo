import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { IPayoutRepository } from "../interfaces/payout-repository.js";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";

describe("PayoutAdjustmentService aggregated refund lines", () => {
  it("updates an existing refund line instead of inserting a duplicate", async () => {
    const openPayout = {
      id: "po-open",
      legalEntityId: "00000000-0000-4000-8000-000000000001",
      periodStart: new Date(),
      periodEnd: new Date(),
      grossAmount: "-20.00",
      platformFee: "0.00",
      stripeFee: "0.00",
      netAmount: "-20.00",
      currency: "GBP",
      status: "scheduled" as const,
      stripeTransferId: null,
      xeroBillId: null,
      failureReason: null,
      processedAt: null,
      statementUrl: null,
      statementGenerationError: null,
      createdAt: new Date(),
    };
    const repo: IPayoutRepository = {
      findOpenPayoutForEntity: vi.fn().mockResolvedValue(openPayout),
      lineExistsForSourceEvent: vi.fn().mockResolvedValue(false),
      findLineForPaymentAndKind: vi.fn().mockResolvedValue({
        id: "line-refund-1",
        payoutId: "po-open",
        paymentId: "pay_1",
        amount: "-20.00",
        kind: "refund",
        createdByUserId: null,
        note: null,
        createdAt: new Date(),
      }),
      updateLineAmount: vi.fn().mockResolvedValue({
        id: "line-refund-1",
        payoutId: "po-open",
        paymentId: "pay_1",
        amount: "-40.00",
        kind: "refund",
        createdByUserId: null,
        note: null,
        createdAt: new Date(),
      }),
      findById: vi.fn().mockResolvedValue(openPayout),
      listLines: vi.fn().mockResolvedValue([]),
      updateTotals: vi.fn(),
      create: vi.fn(),
      insertLine: vi.fn(),
      tryInsertSaleLine: vi.fn(),
      list: vi.fn(),
      findByStripeTransferId: vi.fn(),
      findUnlinkedCapturedPayments: vi.fn(),
      listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
      listScheduledPayoutsAwaitingTransfer: vi.fn(),
      updateStatus: vi.fn(),
      updateXeroBillId: vi.fn(),
      reconcileStripeTransfer: vi.fn(),
      setStatementUrl: vi.fn(),
      setStatementGenerationError: vi.fn(),
      clearStatementGenerationError: vi.fn(),
      sumRefundLineCentsForPayment: vi.fn(),
    };
    const db = {
      transaction: vi.fn(async (fn: (tx: Database) => Promise<void>) => fn(db as Database)),
    } as unknown as Database;
    const svc = new PayoutAdjustmentService(db, repo);

    await svc.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: openPayout.legalEntityId,
      paymentId: "pay_1",
      amount: "-20.00",
      kind: "refund",
      sourceEventId: "evt_refund_2",
      note: "second partial",
    });

    expect(repo.insertLine).not.toHaveBeenCalled();
    expect(repo.updateLineAmount).toHaveBeenCalledWith("line-refund-1", "-40.00", "evt_refund_2");
  });
});
