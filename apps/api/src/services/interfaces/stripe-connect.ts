import type { LegalEntity } from "@auction/types";

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

  /** Current Connect status for the legal entity (cached on the entity row). */
  getStatus(legalEntityId: string): Promise<ConnectAccountStatus>;

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

  /** Verify and process a Stripe Connect webhook event
   * (`account.updated`, `capability.updated`, `transfer.*`).
   */
  handleWebhook(rawBody: string, signature: string | undefined): Promise<{ processed: boolean }>;

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
