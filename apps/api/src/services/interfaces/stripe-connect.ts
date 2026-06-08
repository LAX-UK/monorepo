import type { Database } from "@auction/db";
import type { LegalEntity } from "@auction/types";
import type Stripe from "stripe";

export type ConnectClientConfig = {
  publishableKey: string | null;
  connectEnforced: boolean;
};

export type ConnectSessionSurface = "onboarding" | "management";

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
  /** True when live Stripe sync failed and cached flags were returned instead. */
  syncDegraded?: boolean;
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

export class StripeConnectNotConfiguredError extends Error {
  constructor() {
    super("stripe_connect_not_configured: set STRIPE_SECRET_KEY to enable Connect");
    this.name = "StripeConnectNotConfiguredError";
  }
}

/** Webhook apply hooks for Connect account state (DIP for ConnectWebhookHandler). */
export interface IConnectAccountWebhookPort {
  applyAccountUpdate(account: Stripe.Account, db?: Database): Promise<void>;
  applyAccountDeauthorized(stripeAccountId: string, db?: Database): Promise<void>;
}

/** Live readiness sync before payout transfer (avoids coupling initiation to full account service). */
export interface IConnectAccountReadinessSync {
  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus>;
}

/** Account lifecycle: create, status, sync. */
export interface IConnectAccountSync
  extends IConnectAccountWebhookPort,
    IConnectAccountReadinessSync {
  ensureAccount(legalEntityId: string): Promise<CreateAccountResult>;
  getStatus(legalEntityId: string): Promise<ConnectAccountStatus>;
  syncAccountFromStripe(legalEntityId: string): Promise<ConnectAccountStatus>;
  createOnboardingLink(
    legalEntityId: string,
    returnUrl: string,
    refreshUrl: string,
  ): Promise<AccountLink>;
  createDashboardLink(legalEntityId: string): Promise<AccountLink>;
  handleConnectedAccountEvent(event: Stripe.Event): Promise<{ processed: boolean }>;
}

/** Embedded Connect sessions + client bootstrap config. */
export interface IConnectSessionProvider {
  isConfigured(): boolean;
  getClientConfig(): ConnectClientConfig;
  createAccountSession(
    legalEntityId: string,
    role: string,
    surface: ConnectSessionSurface,
  ): Promise<{ clientSecret: string }>;
}

/** Payout transfer initiation + transfer webhooks. */
export interface IConnectTransferInitiator {
  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }>;
  initiateTransfer(
    payoutId: string,
    opts?: { keepScheduledOnTransferFailure?: boolean },
  ): Promise<InitiateTransferResult>;
}

export interface IStripeConnectService
  extends IConnectAccountSync,
    IConnectSessionProvider,
    IConnectTransferInitiator {}
