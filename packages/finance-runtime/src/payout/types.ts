import type { HeldSettlementSale } from "@auction/domain";
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
  /**
   * What the person confirmed from the preview. When given, the run pays exactly this or nothing:
   * any other net, sale or deal is refused as `figures_changed`.
   */
  confirmed?: ConfirmedSettlement;
};

/** The preview a person confirmed: what the seller receives and the sales and deals that make it. */
export type ConfirmedSettlement = {
  /** What the seller receives, in pence. */
  netPence: number;
  /** The payments of the ready sales. */
  paymentIds: readonly string[];
  /** The released private-sale deals. */
  dealIds: readonly string[];
};

/** The period the settlement covers, once it has been worked out. */
export type ResolvedSettlementInput = {
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  reason?: string;
  /**
   * The payments the run holds locked; only these are paid, and any other waits for the next run.
   * Left out, every payment waiting for the entity is paid.
   */
  heldPaymentIds?: ReadonlySet<string>;
  /** What the person confirmed; the run refuses to pay anything else. */
  confirmed?: ConfirmedSettlement;
};

export type CreateSettlementResult =
  | {
      ok: true;
      payout: import("@auction/types").Payout & { lines: PayoutLine[] };
      /** Sales left out of this payout because their seller terms are held, with the reason. */
      heldSales?: HeldSettlementSale[];
    }
  | {
      ok: false;
      /**
       * `figures_changed`: the run would pay something other than what was confirmed (a sale became
       * ready or was paid, a deal was released, an amount moved). Nothing is stored.
       */
      reason:
        | "no_pending_payments"
        | "figures_changed"
        | import("@auction/domain").SettlementPeriodRefusal;
      /** Sales waiting that the run could not pay, because their seller terms are held. */
      heldSales?: HeldSettlementSale[];
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
        | "payout_changed"
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
