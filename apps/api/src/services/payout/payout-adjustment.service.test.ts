import type { Database } from "@auction/db";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
import { transactionRunnerFromDb } from "../../test/transaction-runner-from-db.js";
import { PayoutAdjustmentService } from "./payout-adjustment.service.js";

function scheduledPayout(failureReason: string | null = null) {
  return {
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
    failureReason,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date(),
  };
}

/** A repository whose seller has `openPayout` scheduled, with a refund line for `pay_1` on it. */
function fakeRepo(openPayout: ReturnType<typeof scheduledPayout>): IPayoutRepository {
  return {
    findOpenPayoutForEntity: vi.fn().mockResolvedValue(openPayout),
    lockOpenPayoutsForEntities: vi.fn().mockResolvedValue(undefined),
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
    countMatching: vi.fn().mockResolvedValue(0),
    summarizeMatching: vi.fn().mockResolvedValue({
      total: 0,
      scheduled: 0,
      inTransit: 0,
      paid: 0,
      failed: 0,
      reversed: 0,
      clawbackPending: 0,
      totalNet: "0.00",
      readiness: {
        inFlightCount: 0,
        missingTransferRefCount: 0,
        withFailureReasonCount: 0,
        withStatementErrorCount: 0,
        clawbackCount: 0,
        failedCount: 0,
      },
    }),
    countCreatedAtByDay: vi.fn().mockResolvedValue(new Map()),
    findByStripeTransferId: vi.fn(),
    // The open payout, read again under its row lock.
    findByIdForUpdate: vi.fn().mockResolvedValue(openPayout),
    lockPayment: vi.fn(),
    lockSettlementForEntity: vi.fn(),
    lockPendingPayments: vi.fn(),
    findUnlinkedCapturedPayments: vi.fn(),
    listLegalEntityIdsWithUnlinkedCapturedPayments: vi.fn(),
    listScheduledPayoutsAwaitingTransfer: vi.fn(),
    updateStatus: vi.fn(),
    updateStatusIfCurrent: vi.fn().mockResolvedValue(null),
    updateXeroBillId: vi.fn(),
    reconcileStripeTransfer: vi.fn(),
    setStatementUrl: vi.fn(),
    setStatementGenerationError: vi.fn(),
    clearStatementGenerationError: vi.fn(),
    sumRefundLineCentsForPayment: vi.fn(),
    // Paid out under the old rule: the refund is charged as it stands.
    findSellerClawbackFacts: vi.fn().mockResolvedValue({
      paymentPence: 10_000,
      paidOut: { kind: "old_rule" },
      clawedBackPence: 2000,
      buyerRefundAnsweredPence: 2000,
    }),
  };
}

function serviceOver(repo: IPayoutRepository) {
  const db = {
    transaction: vi.fn(async (fn: (tx: Database) => Promise<void>) => fn(db as Database)),
  } as unknown as Database;
  return new PayoutAdjustmentService(transactionRunnerFromDb(db), repo, (rootRepo) => rootRepo);
}

describe("PayoutAdjustmentService aggregated refund lines", () => {
  it("updates an existing refund line instead of inserting a duplicate", async () => {
    const openPayout = scheduledPayout();
    const repo = fakeRepo(openPayout);
    const svc = serviceOver(repo);

    await svc.addPaymentLineToOpenPayoutOrCreateClawback({
      legalEntityId: openPayout.legalEntityId,
      paymentId: "pay_1",
      amount: "-20.00",
      kind: "refund",
      sourceEventId: "evt_refund_2",
      note: "second partial",
    });

    expect(repo.insertLine).not.toHaveBeenCalled();
    // The line now answers for both refunds: the £20.00 it held and the £20.00 added.
    expect(repo.updateLineAmount).toHaveBeenCalledWith(
      "line-refund-1",
      "-40.00",
      "evt_refund_2",
      4000,
    );
  });
});

describe("PayoutAdjustmentService locks", () => {
  const disputeLine = (legalEntityId: string) => ({
    legalEntityId,
    paymentId: "pay_1",
    amount: "-20.00",
    kind: "dispute" as const,
    sourceEventId: "dispute:dp_1:pay_1:withdrawn",
    note: "Dispute funds withdrawn",
  });

  it("takes the line's payment before the payout, whoever calls", async () => {
    const openPayout = scheduledPayout();
    const repo = fakeRepo(openPayout);

    await serviceOver(repo).addPaymentLineToOpenPayoutOrCreateClawback(
      disputeLine(openPayout.legalEntityId),
    );

    expect(repo.lockPayment).toHaveBeenCalledWith("pay_1");
    const paymentLockedAt =
      vi.mocked(repo.lockPayment).mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const payoutLockedAt = vi.mocked(repo.findByIdForUpdate).mock.invocationCallOrder[0] ?? -1;
    expect(paymentLockedAt).toBeLessThan(payoutLockedAt);
  });

  it("puts the line on a new payout when, under its lock, the open one's last transfer attempt has an unknown outcome", async () => {
    const seenOpen = scheduledPayout();
    const repo = fakeRepo(seenOpen);
    vi.mocked(repo.findByIdForUpdate).mockResolvedValue(
      scheduledPayout("stripe_transfer_outcome_unknown: unknown - socket hang up"),
    );
    vi.mocked(repo.create).mockResolvedValue({ ...seenOpen, id: "po-new" });

    await serviceOver(repo).addPaymentLineToOpenPayoutOrCreateClawback(
      disputeLine(seenOpen.legalEntityId),
    );

    expect(repo.updateLineAmount).not.toHaveBeenCalled();
    expect(repo.insertLine).toHaveBeenCalledWith(expect.objectContaining({ payoutId: "po-new" }));
  });
});
