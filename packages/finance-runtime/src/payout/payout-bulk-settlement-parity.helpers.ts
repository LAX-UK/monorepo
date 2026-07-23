import type { IPayoutRepository, PendingPaymentRow } from "@auction/persistence/interfaces";
import type { Payout, PayoutLine } from "@auction/types";
import { runBulkSettlementWithTransfers } from "./payout-bulk-transfer.js";
import type { PayoutSettlementDeps } from "./payout-helpers.js";
import type { BulkSettlementWithTransfersResult, InitiateTransferResult } from "./types.js";

export function entityId(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

export function pending(rows: Partial<PendingPaymentRow>[]): PendingPaymentRow[] {
  return rows.map((r, i) => ({
    id: r.id ?? `p${i + 1}`,
    amount: r.amount ?? "100.00",
    platformFee: r.platformFee ?? "5.00",
    capturedAt: r.capturedAt ?? new Date(`2026-01-0${i + 1}T00:00:00Z`),
    ...(r.settlementAmount !== undefined ? { settlementAmount: r.settlementAmount } : {}),
  }));
}

export function payoutRow(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "po1",
    legalEntityId: entityId(1),
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-31"),
    grossAmount: "1000.00",
    platformFee: "50.00",
    stripeFee: "0.00",
    netAmount: "950.00",
    currency: "GBP",
    status: "scheduled",
    stripeTransferId: null,
    xeroBillId: null,
    failureReason: null,
    processedAt: null,
    statementUrl: null,
    statementGenerationError: null,
    createdAt: new Date("2026-02-01"),
    ...overrides,
  };
}

export function makeSettlementRepo(overrides: Partial<IPayoutRepository> = {}): IPayoutRepository {
  const defaultInsertLine = async (input: {
    payoutId: string;
  }): Promise<PayoutLine> => ({
    id: "line-default",
    payoutId: input.payoutId,
    paymentId: "p1",
    amount: "10.00",
    kind: "sale",
    createdByUserId: null,
    note: null,
    createdAt: new Date(),
  });

  return {
    create: async (input) => payoutRow({ legalEntityId: input.legalEntityId }),
    insertLine: defaultInsertLine,
    tryInsertSaleLine: async (input) => defaultInsertLine({ payoutId: input.payoutId }),
    list: async () => [],
    countMatching: async () => 0,
    summarizeMatching: async () =>
      ({
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
          reversedCount: 0,
          blockerPayoutCount: 0,
        },
      }) as Awaited<ReturnType<IPayoutRepository["summarizeMatching"]>>,
    countCreatedAtByDay: async () => new Map(),
    findById: async () => null,
    findByStripeTransferId: async () => null,
    listLines: async () => [],
    findUnlinkedCapturedPayments: async () => [],
    listLegalEntityIdsWithUnlinkedCapturedPayments: async () => [],
    updateTotals: async () => payoutRow(),
    updateStatus: async () => payoutRow(),
    updateStatusIfCurrent: async () => null,
    updateXeroBillId: async () => payoutRow(),
    reconcileStripeTransfer: async () => payoutRow(),
    setStatementUrl: async () => undefined,
    setStatementGenerationError: async () => undefined,
    clearStatementGenerationError: async () => undefined,
    findOpenPayoutForEntity: async () => null,
    lineExistsForSourceEvent: async () => false,
    listScheduledPayoutsAwaitingTransfer: async () => [],
    sumRefundLineCentsForPayment: async () => 0,
    findLineForPaymentAndKind: async () => null,
    updateLineAmount: async () => undefined,
    ...overrides,
  } as IPayoutRepository;
}

export function settlementDeps(repo: IPayoutRepository): PayoutSettlementDeps {
  return {
    repo,
    transactionRunner: null,
    domainEventSink: null,
    payoutAdjustments: undefined,
    payoutRepoForTx: () => repo,
  };
}

export async function runBulkSettlementParity(
  deps: PayoutSettlementDeps,
  initiateTransfer: (payoutId: string) => Promise<InitiateTransferResult>,
): Promise<BulkSettlementWithTransfersResult> {
  return runBulkSettlementWithTransfers(deps, null, {
    initiateTransfer: (payoutId) => initiateTransfer(payoutId),
  });
}

export function snapshotBulkResult(r: BulkSettlementWithTransfersResult) {
  return {
    eligibleEntityCount: r.settlement.eligibleEntityCount,
    createdCount: r.settlement.createdCount,
    settlementOutcomes: r.settlement.items.map((i) => ({
      legalEntityId: i.legalEntityId,
      outcome: i.outcome,
      reason: i.reason,
      payoutId: i.payoutId,
    })),
    transferOutcomes: r.transfers.items.map((i) => ({
      legalEntityId: i.legalEntityId,
      payoutId: i.payoutId,
      outcome: i.outcome,
      resume: i.resume,
      reason: i.reason,
      stripeErrorCode: i.stripeErrorCode,
    })),
    transferSummary: r.transfers.summary.byOutcome,
  };
}
