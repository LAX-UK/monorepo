import type { PayoutLine, StripeConnectRequirementError } from "@auction/types";

/**
 * A settlement to run. The period is worked out inside the settlement, after the entity is locked,
 * so two runs can never be handed overlapping periods: it ends at `periodEnd` and starts where the
 * entity's last settled period ended. `periodStart` only asks for a later start.
 */
export type CreateSettlementInput = {
  legalEntityId: string;
  /** Inclusive UTC end of the period: the moment the run is made. */
  periodEnd: Date;
  /** A start later than where the last settled period ended; left out, the run continues from it. */
  periodStart?: Date;
  /** Why staff ran it, kept in the audit event. */
  reason?: string;
};

/** The period the settlement covers, once it has been worked out. */
export type ResolvedSettlementInput = {
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  reason?: string;
};

export type CreateSettlementResult =
  | { ok: true; payout: import("@auction/types").Payout & { lines: PayoutLine[] } }
  | {
      ok: false;
      reason: "no_pending_payments" | import("./settlement-period.js").SettlementPeriodRefusal;
    };

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

export type InitiateTransferResult =
  | { ok: true; stripeTransferId: string }
  | {
      ok: false;
      reason:
        | "stripe_not_configured"
        | "internal_misconfiguration"
        | "payout_not_found"
        | "payout_already_processed"
        | "entity_not_found"
        | "no_connect_account"
        | "connect_not_ready"
        | "negative_net_amount"
        | "transfer_blocked"
        | "stripe_error";
      stripeErrorCode?: string;
      stripeErrorMessage?: string;
    };

/** How a transfer attempt treats the payout it starts from. */
export type InitiateTransferOptions = {
  keepScheduledOnTransferFailure?: boolean;
  /**
   * Start from a payout whose earlier transfer failed instead of a scheduled one. The payout stays
   * failed until the new transfer is accepted, so the settlement cron never competes with it.
   */
  retryFailed?: boolean;
};

/** Whether a Stripe transfer staff name can stand as a payout's transfer. */
export type TransferAdoptionVerification =
  | { ok: true; stripeTransferId: string }
  | {
      ok: false;
      reason:
        | "stripe_not_configured"
        | "internal_misconfiguration"
        | "payout_not_found"
        | "no_connect_account"
        | "transfer_not_found"
        | "stripe_error"
        | "transfer_belongs_to_other_payout"
        | "transfer_not_for_this_payout"
        | "transfer_reversed"
        | "destination_mismatch"
        | "currency_mismatch"
        | "amount_mismatch";
    };

export type BulkSettlementEntityOutcomeLog = {
  legalEntityId: string;
  payoutId?: string;
  resume?: boolean;
  outcome:
    | "settlement_skipped"
    | "settlement_db_error"
    | "transfer_initiated"
    | "transfer_failed"
    | "connect_not_ready"
    | "committed_no_transfer"
    | "transfer_skipped"
    | "transfer_blocked";
  reason?: string;
  stripeTransferId?: string;
  stripeErrorCode?: string;
};

export type BulkSettlementTransferPort = {
  initiateTransfer: (
    payoutId: string,
    opts?: InitiateTransferOptions,
  ) => Promise<InitiateTransferResult>;
  onEntityOutcome?: (row: BulkSettlementEntityOutcomeLog) => void;
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

export type ConnectAccountStatus = {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsCurrentlyDue: string[];
  requirementsErrors: StripeConnectRequirementError[];
  disabledReason: string | null;
  ready: boolean;
  syncDegraded?: boolean;
};

export interface IConnectAccountReadinessSync {
  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus>;
}
