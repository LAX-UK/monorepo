import type { SellerClawbackFacts } from "@auction/domain";
import type { Payout, PayoutLine, PayoutLineKind, PayoutSellerTermsTotals } from "@auction/types";
import type { StoredSellerTerms } from "./sale-seller-terms.store.js";

/** A captured lot payment that is on no payout yet, with what settlement pays it from. */
export type PendingPaymentRow = {
  id: string;
  /** What the buyer paid. */
  amount: string;
  /** The old-rule fee stored on the payment; kept for audit, never paid from. */
  platformFee: string;
  capturedAt: Date | null;
  /** The lot the payment is for. */
  lotId: string | null;
  /** The payment's seller-terms snapshot, or `null` when it was raised before snapshots. */
  sellerTerms: StoredSellerTerms | null;
  /** What the buyer has been refunded for the payment so far, in pence. */
  refundedPence: number;
};

export type CreatePayoutInput = {
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  /** The hammer, commission and VAT of the lot sales the payout pays from their snapshots. */
  sellerTermsTotals?: PayoutSellerTermsTotals | null;
};

export type InsertPayoutLineInput = {
  payoutId: string;
  paymentId: string | null;
  amount: string;
  kind: PayoutLineKind;
  createdByUserId: string | null;
  note: string | null;
  /** Stripe event ID for webhook-originated lines (idempotency). */
  sourceEventId?: string | null;
  /** On a lot's sale line: the seller-terms snapshot it pays. */
  sellerTermsId?: string | null;
  /**
   * On a refund line: the buyer's refund, in pence, the line answers for. Negative on a line giving
   * back a failed refund: the buyer refund it reverses (its amount is then zero or more).
   */
  buyerRefundPence?: number | null;
};

/** What a buyer's refund is charged back to the seller from: see `SellerClawbackFacts`. */
export type { SellerClawbackFacts };

export type ListPayoutsFilter = {
  legalEntityId?: string;
  status?: Payout["status"];
  /** A payout reference (PO-YYYY-XXXXXXXX), the start of a payout id, or a seller name. */
  search?: string;
  limit?: number;
  offset?: number;
};

export type ReconcileStripeTransferPatch = {
  /** Stripe transfer id (tr_...). Persisted for idempotent lookup. */
  stripeTransferId: string;
  /** Next payout status derived from the Connect transfer lifecycle. */
  status: Payout["status"];
  /** Stripe fee in major currency units when available from webhook payload. */
  stripeFee?: string | undefined;
  /** Set when Stripe confirms the transfer was paid. */
  processedAt?: Date | null | undefined;
  failureReason?: string | null | undefined;
};

export interface IPayoutReadRepository {
  /** List payouts (admin or per-entity), newest first. */
  list(filter: ListPayoutsFilter): Promise<Payout[]>;
  /** Find a payout by id (any entity). */
  findById(payoutId: string): Promise<Payout | null>;

  /** Find a payout and lock its row until the surrounding transaction ends (SELECT FOR UPDATE). */
  findByIdForUpdate(payoutId: string): Promise<Payout | null>;

  /**
   * Hold the payment's row (`FOR UPDATE`) until the surrounding transaction ends. A line for a
   * payment takes it before the payout's row, the order every refund and settlement path locks in,
   * so a path that does not already hold it cannot wait for the payment while holding the payout.
   * Re-entrant: a no-op for a transaction that already holds it.
   */
  lockPayment(paymentId: string): Promise<void>;

  /** Serialise settlement for one legal entity until the surrounding transaction ends. */
  lockSettlementForEntity(legalEntityId: string): Promise<void>;
  /**
   * Hold, until the surrounding transaction ends, the row of every payment waiting for this legal
   * entity's payout run, in payment id order (the order a payment group locks its invoices in).
   * Every refund path holds the payment row while it records the refund and charges the seller, so
   * a refund either commits before the run reads what was refunded, or waits until the sale line
   * is in place and is charged as a refund after payout. Taken after `lockSettlementForEntity`.
   * Each held payment's buyer refund record is then topped up from the previous release's refund
   * lines, as a refund path does under the same lock. Returns the ids it holds: a payment that
   * becomes payable after this is not held, so the run leaves it to the next one.
   */
  lockPendingPayments(legalEntityId: string): Promise<string[]>;
  /** Find a payout by its Stripe transfer id (webhook idempotency lookup). */
  findByStripeTransferId(stripeTransferId: string): Promise<Payout | null>;
  /** Lines for a payout, oldest-first by created_at. */
  listLines(payoutId: string): Promise<PayoutLine[]>;
  /** Find captured payments for a legal entity that are NOT already linked
   * to a payout via a `kind=sale` payout line. Used by both `previewPending`
   * and the settlement engine.
   */
  findUnlinkedCapturedPayments(legalEntityId: string): Promise<PendingPaymentRow[]>;
  /** Distinct seller legal entities that have at least one captured payment
   * not yet linked to any payout line (used by bulk settlement cron).
   */
  listLegalEntityIdsWithUnlinkedCapturedPayments(): Promise<string[]>;
  /** Find the most recent payout for a legal entity that can still take
   * lines: `scheduled` only, since once its transfer has started a line would
   * change the record but not the money sent, and not one whose last transfer
   * attempt ended with its outcome unknown (`payoutTakesLines`). Used for
   * refund, give-back and dispute lines. Returns null if no such payout exists.
   */
  findOpenPayoutForEntity(legalEntityId: string): Promise<Payout | null>;
  /**
   * Hold (`FOR UPDATE`), until the surrounding transaction ends, every payout that can take lines
   * (as `findOpenPayoutForEntity` reads them) for these legal entities, in one global order: legal
   * entity id, then payout id. A transaction that moves payouts for several sellers takes this
   * before it changes any, so two such transactions over the same sellers queue on the first payout
   * instead of each holding one the other needs. Take it after the payments, as every line does.
   */
  lockOpenPayoutsForEntities(legalEntityIds: readonly string[]): Promise<void>;
  /** Check if a payout line with the given sourceEventId already exists.
   * Used for idempotency in webhook handlers.
   */
  lineExistsForSourceEvent(sourceEventId: string): Promise<boolean>;
  /** The buyer refunds the seller's ledger has answered for, for a payment, in PENCE (positive).
   * A refund line records the buyer's refund it answers for (negative on a line giving back a
   * failed refund); one written before that was recorded answers for its own amount, with its
   * sign. The lines are added up with their sign, so a give-back cancels the charge it reverses.
   * Used by the `charge.refunded` webhook to compute per-event refund
   * delta because Stripe's `amount_refunded` field is cumulative across all refunds.
   */
  sumRefundLineCentsForPayment(paymentId: string): Promise<number>;
  /** What a refund of the payment is charged back to the seller from. */
  findSellerClawbackFacts(paymentId: string): Promise<SellerClawbackFacts>;
  /** Existing adjustment line for a payment on a specific payout (refund/dispute aggregation). */
  findLineForPaymentAndKind(
    payoutId: string,
    paymentId: string,
    kind: PayoutLineKind,
  ): Promise<PayoutLine | null>;
}

export interface IPayoutWriteRepository {
  /** Insert a payout row (no lines). */
  create(input: CreatePayoutInput): Promise<Payout>;
  /** Insert one payout line and return the row. */
  insertLine(input: InsertPayoutLineInput): Promise<PayoutLine>;
  /** Insert a sale line; returns null when the payment is already settled elsewhere. */
  tryInsertSaleLine(input: InsertPayoutLineInput): Promise<PayoutLine | null>;
  /** persist Xero ACCPAY bill id after worker/API projection. */
  updateXeroBillId(payoutId: string, xeroBillId: string): Promise<void>;
  /** Update only the totals on a payout (used after appending an
   * adjustment line). Returns the updated row.
   */
  updateTotals(
    payoutId: string,
    totals: {
      grossAmount: string;
      platformFee: string;
      netAmount: string;
      sellerTermsTotals?: PayoutSellerTermsTotals | null;
    },
  ): Promise<Payout>;
  /** Transition the payout's status (and processedAt + stripeTransferId
   * when paid). Returns the updated row.
   */
  updateStatus(
    payoutId: string,
    patch: {
      status: Payout["status"];
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    },
  ): Promise<Payout>;
  /** Compare-and-set status transition; returns null when `expectedStatus` no longer matches. */
  updateStatusIfCurrent(
    payoutId: string,
    expectedStatus: Payout["status"],
    patch: {
      status: Payout["status"];
      stripeTransferId?: string | null;
      processedAt?: Date | null;
      failureReason?: string | null;
    },
  ): Promise<Payout | null>;
  /** Update Stripe Connect reconciliation fields and recompute net amount when
   * a Stripe fee is supplied.
   */
  reconcileStripeTransfer(payoutId: string, patch: ReconcileStripeTransferPatch): Promise<Payout>;
  /** persist Spaces URL after PDF generation; clears prior generation error. */
  setStatementUrl(payoutId: string, statementUrl: string): Promise<void>;
  /** terminal failure message after job retries exhausted. */
  setStatementGenerationError(payoutId: string, message: string): Promise<void>;
  /** clear error when re-enqueuing generation (e.g. admin retry). */
  clearStatementGenerationError(payoutId: string): Promise<void>;
  /** Update an existing payout line amount (used when aggregating partial refunds). */
  updateLineAmount(
    lineId: string,
    amount: string,
    sourceEventId?: string | null,
    buyerRefundPence?: number | null,
  ): Promise<PayoutLine>;
}

export interface IPayoutLifecycleRepository {
  /** `scheduled` payouts with positive net and no `stripe_transfer_id` yet —
   * includes rows awaiting a Connect transfer retry after a transient failure.
   */
  listScheduledPayoutsAwaitingTransfer(limit?: number): Promise<Payout[]>;
}

export type AdminPayoutListSummary = {
  total: number;
  scheduled: number;
  inTransit: number;
  paid: number;
  failed: number;
  reversed: number;
  clawbackPending: number;
  /** Payouts held because Stripe already has a transfer staff must resolve. */
  transferBlocked: number;
  totalNet: string;
  readiness: {
    inFlightCount: number;
    missingTransferRefCount: number;
    withFailureReasonCount: number;
    withStatementErrorCount: number;
    clawbackCount: number;
    failedCount: number;
    reversedCount: number;
    blockerPayoutCount: number;
  };
};

export interface IPayoutAnalyticsRepository {
  countMatching(filter: Omit<ListPayoutsFilter, "limit" | "offset">): Promise<number>;
  /** Filtered aggregate counts and settlement-readiness metrics for admin list KPIs. */
  summarizeMatching(
    filter: Omit<ListPayoutsFilter, "limit" | "offset">,
  ): Promise<AdminPayoutListSummary>;
  /** UTC day counts for admin KPI trends (created_at >= rangeStart). */
  countCreatedAtByDay(rangeStart: Date): Promise<Map<string, number>>;
}

/** Who processed a payout: the separation-of-duty facts its reversal depends on. */
export interface IPayoutProcessorReader {
  /**
   * Everyone who acted on the payout before any reversal: created the settlement, adjusted it or
   * marked it paid. Each person once; system actions are not listed.
   */
  listProcessorUserIds(payoutId: string): Promise<string[]>;
}

/** Full payout persistence port — composite of segregated read/write/lifecycle/analytics slices (ISP). */
export interface IPayoutRepository
  extends IPayoutReadRepository,
    IPayoutWriteRepository,
    IPayoutLifecycleRepository,
    IPayoutAnalyticsRepository {}
