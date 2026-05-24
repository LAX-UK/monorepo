import type { Payout, PayoutLine, PayoutLineKind } from "@auction/types";

export type PendingPaymentRow = {
  id: string;
  amount: string;
  platformFee: string;
  capturedAt: Date | null;
  /** Sale line amount after prior refund/dispute payout lines (defaults to `amount`). */
  settlementAmount?: string;
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
};

export type ListPayoutsFilter = {
  legalEntityId?: string;
  status?: Payout["status"];
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

export interface IPayoutRepository {
  /** Insert a payout row (no lines). */
  create(input: CreatePayoutInput): Promise<Payout>;

  /** Insert one payout line and return the row. */
  insertLine(input: InsertPayoutLineInput): Promise<PayoutLine>;

  /** Insert a sale line; returns null when the payment is already settled elsewhere. */
  tryInsertSaleLine(input: InsertPayoutLineInput): Promise<PayoutLine | null>;

  /** List payouts (admin or per-entity), newest first. */
  list(filter: ListPayoutsFilter): Promise<Payout[]>;

  /** Find a payout by id (any entity). */
  findById(payoutId: string): Promise<Payout | null>;

  /** persist Xero ACCPAY bill id after worker/API projection. */
  updateXeroBillId(payoutId: string, xeroBillId: string): Promise<void>;

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

  /** `scheduled` payouts with positive net and no `stripe_transfer_id` yet —
   * includes rows awaiting a Connect transfer retry after a transient failure.
   */
  listScheduledPayoutsAwaitingTransfer(limit?: number): Promise<Payout[]>;

  /** Update only the totals on a payout (used after appending an
   * adjustment line). Returns the updated row.
   */
  updateTotals(
    payoutId: string,
    totals: { grossAmount: string; platformFee: string; netAmount: string },
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

  /** Find the most recent payout for a legal entity that is still
   * modifiable (scheduled or in_transit). Used for inserting negative lines
   * from refunds/disputes. Returns null if no such payout exists.
   */
  findOpenPayoutForEntity(legalEntityId: string): Promise<Payout | null>;

  /** Check if a payout line with the given sourceEventId already exists.
   * Used for idempotency in webhook handlers.
   */
  lineExistsForSourceEvent(sourceEventId: string): Promise<boolean>;

  /** Sum of existing refund payout lines for a payment, in PENCE (positive value).
   * Used by the `charge.refunded` webhook to compute per-event refund delta
   * because Stripe's `amount_refunded` field is cumulative across all refunds.
   */
  sumRefundLineCentsForPayment(paymentId: string): Promise<number>;

  /** Existing adjustment line for a payment on a specific payout (refund/dispute aggregation). */
  findLineForPaymentAndKind(
    payoutId: string,
    paymentId: string,
    kind: PayoutLineKind,
  ): Promise<PayoutLine | null>;

  /** Update an existing payout line amount (used when aggregating partial refunds). */
  updateLineAmount(
    lineId: string,
    amount: string,
    sourceEventId?: string | null,
  ): Promise<PayoutLine>;
}
