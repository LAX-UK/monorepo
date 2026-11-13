import {
  type ISellerTermsPolicy,
  SELLER_RULE_VERSION,
  type SellerTermsSnapshot,
  parseMoneyToMinorUnits,
} from "@auction/domain";
import type {
  IPayoutRepository,
  ISaleSellerTermsStore,
  PendingPaymentRow,
} from "@auction/persistence/interfaces";
import type { Payout, PayoutLine } from "@auction/types";
import { runBulkSettlementWithTransfers } from "./payout-bulk-transfer.js";
import type { PayoutSettlementDeps } from "./payout-helpers.js";
import { type ISettlementSellerTerms, SettlementSellerTerms } from "./settlement-seller-terms.js";
import type { BulkSettlementWithTransfersResult, InitiateTransferResult } from "./types.js";

export function entityId(i: number): string {
  return `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
}

/**
 * A priced snapshot for a test sale: `hammer` less `deductions` (taken as commission, with the
 * company not VAT-registered so there is no VAT line), so a test reads its figures directly.
 */
export function pricedTerms(
  hammer: string,
  deductions: string,
  ids: { lotId?: string; sellerLegalEntityId?: string } = {},
): SellerTermsSnapshot {
  const hammerPence = Number(parseMoneyToMinorUnits(hammer));
  const commissionPence = Number(parseMoneyToMinorUnits(deductions));
  return {
    lotId: ids.lotId ?? "lot-1",
    sellerLegalEntityId: ids.sellerLegalEntityId ?? entityId(1),
    hammerPence,
    premiumPence: 0,
    ruleVersion: SELLER_RULE_VERSION,
    basis: "agreement",
    agreementId: "agreement-1",
    commissionBps: hammerPence > 0 ? Math.round((commissionPence * 10_000) / hammerPence) : 0,
    commissionPence,
    commissionVatTreatment: "not_registered",
    commissionVatBps: 0,
    commissionVatPence: 0,
    otherCharges: [],
    sellerNetPence: hammerPence - commissionPence,
  };
}

/**
 * Pending sales for a test run. Each is priced on its snapshot: by default a hammer of `amount`
 * less `platformFee` as the commission, so a test's figures read as before.
 */
export function pending(rows: Partial<PendingPaymentRow>[]): PendingPaymentRow[] {
  return rows.map((r, i) => {
    const id = r.id ?? `p${i + 1}`;
    const amount = r.amount ?? "100.00";
    const platformFee = r.platformFee ?? "5.00";
    return {
      id,
      amount,
      platformFee,
      capturedAt: r.capturedAt ?? new Date(`2026-01-0${i + 1}T00:00:00Z`),
      lotId: r.lotId ?? `lot-${id}`,
      sellerTerms:
        r.sellerTerms !== undefined
          ? r.sellerTerms
          : {
              id: `terms-${id}`,
              snapshot: pricedTerms(amount, platformFee, { lotId: `lot-${id}` }),
            },
      refundedPence: r.refundedPence ?? 0,
    };
  });
}

/**
 * Seller terms that pay each sale from the snapshot it carries. A test sale without one is
 * priced by `policy` (held with no agreement unless given), stored nowhere.
 */
export function storedSellerTerms(
  policy: ISellerTermsPolicy = {
    snapshotFor: async (request) => ({
      ...request,
      ruleVersion: SELLER_RULE_VERSION,
      basis: "held",
      heldReason: "no_agreement",
    }),
  },
): ISettlementSellerTerms {
  const store: ISaleSellerTermsStore = {
    invoiceLinesForPayment: async () => null,
    recordAtPayout: async ({ paymentId, snapshot }) => ({ id: `terms-${paymentId}`, snapshot }),
    repriceHeld: async (id, snapshot) => ({ id, snapshot }),
  };
  return new SettlementSellerTerms(policy, store);
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

  const repo = {
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
        transferBlocked: 0,
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
    findByIdForUpdate: async () => null,
    lockSettlementForEntity: async () => undefined,
    lockPayment: async () => undefined,
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
    listScheduledPayoutsWithNegativeNet: async () => [],
    sumRefundLineCentsForPayment: async () => 0,
    findSellerClawbackFacts: async () => ({
      paymentPence: 0,
      paidOut: { kind: "not_paid_out" },
      clawedBackPence: 0,
      buyerRefundAnsweredPence: 0,
    }),
    findLineForPaymentAndKind: async () => null,
    updateLineAmount: async () => undefined,
    ...overrides,
  } as IPayoutRepository;
  if (!overrides.lockPendingPayments) {
    // With nothing racing the run, it holds every payment it then finds.
    repo.lockPendingPayments = async (legalEntityId) =>
      (await repo.findUnlinkedCapturedPayments(legalEntityId)).map((p) => p.id);
  }
  return repo;
}

export function settlementDeps(repo: IPayoutRepository): PayoutSettlementDeps {
  return {
    repo,
    transactionRunner: { runInTransaction: (fn) => fn({} as never) },
    domainEventSink: { withTx: () => ({ publish: async () => undefined }) },
    payoutAdjustments: undefined,
    payoutRepoForTx: () => repo,
    sellerTermsForTx: () => storedSellerTerms(),
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
