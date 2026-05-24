import type { LegalEntity } from "@auction/types";
import type Stripe from "stripe";

export type ConnectAccountStatus = {
  /** Stripe account id (acct_…) when present. */
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Stripe `requirements.currently_due` field. */
  requirementsCurrentlyDue: string[];
  /** Stripe `requirements.disabled_reason` when the account is blocked. */
  disabledReason: string | null;
  /** True when the account is active and ready to receive payouts. */
  ready: boolean;
};

export type CreateAccountResult = {
  stripeAccountId: string;
  legalEntity: LegalEntity;
};

export type AccountLink = {
  url: string;
  expiresAt: Date;
};

/** result of initiating a Stripe Connect transfer for a payout. */
export type InitiateTransferResult =
  | { ok: true; stripeTransferId: string }
  | {
      ok: false;
      reason:
        | "stripe_not_configured"
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

export class StripeConnectNotConfiguredError extends Error {
  constructor() {
    super("stripe_connect_not_configured: set STRIPE_SECRET_KEY to enable Connect");
    this.name = "StripeConnectNotConfiguredError";
  }
}

export interface IStripeConnectService {
  isConfigured(): boolean;

  /** Create (or look up) the Stripe Connect Express account for an
   * organisation legal entity. Idempotent — returns the existing account
   * id when one already exists on the entity row.
   */
  ensureAccount(legalEntityId: string, country: string): Promise<CreateAccountResult>;

  /** Current Connect status for the legal entity (live-synced when Stripe is configured). */
  getStatus(legalEntityId: string): Promise<ConnectAccountStatus>;

  /** Refresh Connect flags from Stripe and apply lifecycle promotion when ready. */
  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus>;

  /** Onboarding link the user needs to complete identity / banking. Caller
   * must pass return / refresh URLs; Stripe enforces a short TTL.
   */
  createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink>;

  /** One-time login link to the Stripe Express dashboard (admin / member). */
  createDashboardLink(legalEntityId: string): Promise<AccountLink>;

  /** Process a verified Connect account event (Connected accounts scope). */
  handleConnectedAccountEvent(event: Stripe.Event): Promise<{ processed: boolean }>;

  /** Process a verified platform transfer event (Your account scope). */
  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }>;

  /** Initiate a Stripe Connect transfer for a payout.
   * Called after settlement creation. Handles retry logic internally.
   * On success, emits `payout.transfer_initiated` and updates payout row.
   * On final failure, emits `payout.transfer_failed` (see opts for status).
   */
  initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult>;
}
