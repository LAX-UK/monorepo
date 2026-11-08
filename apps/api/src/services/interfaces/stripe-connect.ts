import type { Database } from "@auction/db";
import type {
  InitiateTransferOptions,
  InitiateTransferResult,
  TransferAdoptionVerification,
} from "@auction/finance-runtime";
import type { LegalEntity, LegalEntityMemberRole } from "@auction/types";
import type Stripe from "stripe";

export type ConnectClientConfig = {
  publishableKey: string | null;
  connectEnforced: boolean;
};

export type ConnectSessionSurface = "onboarding" | "management";

import type { StripeConnectRequirementError } from "@auction/types";

export type ConnectAccountStatus = {
  /** Stripe account id (acct_…) when present. */
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** Stripe `requirements.currently_due` field. */
  requirementsCurrentlyDue: string[];
  /** Stripe `requirements.errors` from the last sync. */
  requirementsErrors: StripeConnectRequirementError[];
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

/** Transfer initiation types: the one definition lives in `@auction/finance-runtime`. */
export type {
  InitiateTransferOptions,
  InitiateTransferResult,
  TransferAdoptionVerification,
} from "@auction/finance-runtime";

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
    role: LegalEntityMemberRole,
    surface: ConnectSessionSurface,
  ): Promise<{ clientSecret: string }>;
}

/** Payout transfer initiation + transfer webhooks. */
export interface IConnectTransferInitiator {
  handleTransferEvent(event: Stripe.Event): Promise<{ processed: boolean }>;
  initiateTransfer(
    payoutId: string,
    opts?: InitiateTransferOptions,
  ): Promise<InitiateTransferResult>;
  /** Fetches the transfer from Stripe and checks it against the payout; changes nothing. */
  verifyTransferForAdoption(
    payoutId: string,
    stripeTransferId: string,
  ): Promise<TransferAdoptionVerification>;
}

/** Initiates platform → seller Stripe Connect transfers for scheduled payouts. */
export interface IConnectTransferInitiationService {
  initiateTransfer(
    payoutId: string,
    opts?: InitiateTransferOptions,
  ): Promise<InitiateTransferResult>;
  verifyTransferForAdoption(
    payoutId: string,
    stripeTransferId: string,
  ): Promise<TransferAdoptionVerification>;
}

export interface IStripeConnectService
  extends IConnectAccountSync,
    IConnectSessionProvider,
    IConnectTransferInitiator {}
