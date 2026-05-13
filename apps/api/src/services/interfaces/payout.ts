import type {
  CreatePayoutAdjustmentInput,
  Payout,
  PayoutLine,
  PayoutLineKind,
  PayoutStatus,
} from "@auction/types";
import type { InitiateTransferResult } from "./stripe-connect.js";

/** Aggregate row used by the seller "next payout" tile. */
export type PendingPayoutPreview = {
  /** Sum of payments captured but not yet allocated to a payout. */
  pendingGross: string;
  pendingPlatformFee: string;
  pendingNet: string;
  /** Number of payments that would be in the next payout. */
  paymentCount: number;
  currency: string;
};

export type PayoutWithLines = Payout & { lines: PayoutLine[] };

export type ListPayoutsFilter = {
  status?: PayoutStatus;
  limit?: number;
  offset?: number;
};

export type AdminListPayoutsFilter = ListPayoutsFilter & {
  legalEntityId?: string;
};

export type CreateSettlementInput = {
  legalEntityId: string;
  /** Inclusive UTC start of period. */
  periodStart: Date;
  /** Inclusive UTC end of period. */
  periodEnd: Date;
  /** Optional override of the platform fee rate (decimal, e.g. 0.18). */
  platformFeeRateOverride?: number;
};

export type CreateSettlementResult =
  | { ok: true; payout: PayoutWithLines }
  | { ok: false; reason: "no_pending_payments" };

export type BulkPayoutSettlementItemResult = {
  legalEntityId: string;
  outcome: "created" | "skipped" | "error";
  payoutId?: string;
  reason?: string;
  message?: string;
};

export type BulkPayoutSettlementResult = {
  eligibleEntityCount: number;
  createdCount: number;
  items: BulkPayoutSettlementItemResult[];
};

/** Port for Stripe Connect transfer attempts (bulk cron injects `stripeConnectService.initiateTransfer`). */
export type BulkSettlementTransferPort = {
  initiateTransfer: (
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ) => Promise<InitiateTransferResult>;
  /** Optional structured log per entity / resume row (cron supplies a pino child). */
  onEntityOutcome?: (row: BulkSettlementEntityOutcomeLog) => void;
};

export type BulkSettlementEntityOutcomeLog = {
  legalEntityId: string;
  payoutId?: string;
  /** When true, this row came from `listScheduledPayoutsAwaitingTransfer` (retry path). */
  resume?: boolean;
  outcome:
    | "settlement_skipped"
    | "settlement_db_error"
    | "transfer_initiated"
    | "transfer_failed"
    | "connect_not_ready"
    | "committed_no_transfer"
    | "transfer_skipped";
  reason?: string;
  stripeTransferId?: string;
  stripeErrorCode?: string;
};

export type BulkSettlementWithTransfersResult = {
  settlement: BulkPayoutSettlementResult;
  transfers: {
    items: BulkSettlementEntityOutcomeLog[];
    summary: {
      totalTransferAttempts: number;
      byOutcome: Record<string, number>;
    };
  };
};

export type MarkPaidInput = {
  stripeTransferId: string;
};

export type StripeTransferReconciliationInput = {
  stripeTransferId: string;
  /** Payout id from Stripe Transfer metadata. Preferred because transfer.created
   * can arrive before `stripe_transfer_id` is already stored locally.
   */
  payoutId?: string | undefined;
  status: "created" | "paid" | "failed" | "reversed";
  /** Stripe fee in major currency units when available from expanded balance transaction. */
  stripeFee?: string | undefined;
  failureReason?: string | null | undefined;
  occurredAt?: Date | undefined;
  /** Stripe event ID for reversal idempotency (payout_line.source_event_id). */
  stripeEventId?: string | undefined;
  /** reversal amount in cents when available. */
  reversedAmountCents?: number | undefined;
};

/** Generic permission failure surfaced from the payout service. Mapped to a
 * 403 (`forbidden`) by the routes layer.
 */
export class PayoutPermissionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "PayoutPermissionError";
  }
}

export class PayoutNotFoundError extends Error {
  readonly code = "payout_not_found";
  constructor() {
    super("payout_not_found");
    this.name = "PayoutNotFoundError";
  }
}

export class PayoutStatusTransitionError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = "PayoutStatusTransitionError";
  }
}

export interface IPayoutService {
  /** Seller-side: list payouts for the acting legal entity. */
  listForLegalEntity(legalEntityId: string, filter?: ListPayoutsFilter): Promise<Payout[]>;

  /** Seller-side: full payout + lines, scoped to the acting entity. */
  getById(legalEntityId: string, payoutId: string): Promise<PayoutWithLines>;

  /** Seller-side: aggregate the captured payments for the acting entity that
   * are not yet linked to a payout. Used for the "next payout" tile.
   */
  previewPending(legalEntityId: string): Promise<PendingPayoutPreview>;

  /** Admin: list payouts across all entities, with optional filter. */
  adminList(filter?: AdminListPayoutsFilter): Promise<Payout[]>;

  /** Admin: roll captured payments for an entity into a single payout
   * (settlement). Returns `no_pending_payments` when there is nothing to
   * settle.
   */
  createSettlement(
    actorUserId: string | null,
    input: CreateSettlementInput,
  ): Promise<CreateSettlementResult>;

  /** Finance automation: create a settlement payout for every legal entity
   * that currently has unlinked captured payments (`actorUserId` null for cron).
   */
  runBulkSettlement(
    actorUserId: string | null,
    opts?: { periodEnd?: Date },
  ): Promise<BulkPayoutSettlementResult>;

  /** Bulk cron: per legal entity, commit settlement (payout + lines +
   * `payout.settlement_created`) in one DB transaction, then attempt Stripe
   * transfer outside the transaction. Processes resume rows (`scheduled`, no
   * transfer id, positive net) in a second pass. Continues after per-entity failures.
   */
  runBulkSettlementWithTransfers(
    actorUserId: string | null,
    port: BulkSettlementTransferPort,
    opts?: { periodEnd?: Date },
  ): Promise<BulkSettlementWithTransfersResult>;

  /** Admin: append a manual adjustment line. Adjustments require both a
   * `note` and a positive/negative `amount`. The payout's `gross / fee /
   * net` totals are recomputed.
   */
  addAdjustment(
    actorUserId: string,
    payoutId: string,
    input: CreatePayoutAdjustmentInput,
    /** Optional kind override; defaults to "adjustment". */
    kind?: PayoutLineKind,
  ): Promise<PayoutWithLines>;

  /** Admin: transition a `scheduled` or `in_transit` payout to `paid`.
   * Requires the Stripe transfer id for audit.
   */
  markPaid(actorUserId: string, payoutId: string, input: MarkPaidInput): Promise<Payout>;

  /** Stripe Connect webhook reconciliation (`transfer.created`, `transfer.paid`,
   * `transfer.failed`, `transfer.reversed`). Idempotent: missing payouts are
   * ignored because webhook delivery can race settlement creation.
   */
  reconcileStripeTransfer(input: StripeTransferReconciliationInput): Promise<Payout | null>;

  /** Admin-only manual reversal bookkeeping (does not call Stripe). */
  adminManualReverse(
    actorUserId: string,
    payoutId: string,
    input: { reason: string },
  ): Promise<Payout>;
}
