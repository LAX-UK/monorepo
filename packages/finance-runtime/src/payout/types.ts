import type { PayoutLine, StripeConnectRequirementError } from "@auction/types";

export type CreateSettlementInput = {
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
};

export type CreateSettlementResult =
  | { ok: true; payout: import("@auction/types").Payout & { lines: PayoutLine[] } }
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
        | "stripe_error";
      stripeErrorCode?: string;
      stripeErrorMessage?: string;
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
    | "transfer_skipped";
  reason?: string;
  stripeTransferId?: string;
  stripeErrorCode?: string;
};

export type BulkSettlementTransferPort = {
  initiateTransfer: (
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
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
