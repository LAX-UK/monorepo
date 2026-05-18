import type { MarketingEvent } from "@auction/types";
import type { KycVerification, UserKycStatus } from "@auction/types";
import type Stripe from "stripe";

export type CreateKycSessionResult = {
  /** Stripe Identity verification session id (vi_…). */
  sessionId: string;
  /** Stripe-hosted client secret for the verifier flow. */
  clientSecret: string;
  /** URL to redirect the user to (Stripe-hosted verifier). Set when using the
   * redirect/return mode.
   */
  hostedUrl: string | null;
  verification: KycVerification;
};

export type KycWebhookHandleResult = {
  verification: KycVerification | null;
  /** True when this delivery updated user KYC columns (not a stale session / no-op branch). */
  appliedUserKycUpdate: boolean;
  /** True when Identity verified the *current* session — run post-verification progression. */
  shouldProgressIndividuals: boolean;
  /** Staged in the same transaction as KYC approval; enqueue after handleWebhook returns. */
  marketingEventToEnqueue?: MarketingEvent;
};

export type KycStatusSummary = {
  status: UserKycStatus;
  verifiedAt: Date | null;
  latestSessionId: string | null;
  pendingExposure: { total: number; currency: string };
  thresholdAmount: number;
  thresholdCurrency: string;
  /** True when KYC is required *now* — i.e. exposure >= threshold and the
   * user is not yet `approved`.
   */
  requiresKyc: boolean;
};

/** Surfaces the configuration sentinel for routes that should refuse to run
 * when STRIPE_SECRET_KEY is missing (e.g. in tests / dev).
 */
export class KycNotConfiguredError extends Error {
  constructor() {
    super("kyc_not_configured: set STRIPE_SECRET_KEY to enable Stripe Identity");
    this.name = "KycNotConfiguredError";
  }
}

/** Thrown by `requireKyc`-guarded paths when the user is below threshold. */
export class KycRequiredError extends Error {
  readonly status = 402;
  readonly code = "kyc_required";
  constructor(public readonly summary: KycStatusSummary) {
    super("kyc_required");
    this.name = "KycRequiredError";
  }
}

export interface IKycService {
  /** True when STRIPE_SECRET_KEY is present and the SDK initialised. */
  isConfigured(): boolean;

  /** Create a Stripe Identity verification session for the user. */
  createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult>;

  /** Latest verification record (any status). */
  getLatestForUser(userId: string): Promise<KycVerification | null>;

  /** Status snapshot: current user.kyc_status + latest session + exposure. */
  getStatus(userId: string): Promise<KycStatusSummary>;

  /** Verify and process an `identity.verification_session.*` event.
   * Returns `{ verification: null }` when the event is unrelated or unmatched.
   */
  handleWebhook(rawBody: string, signature: string | undefined): Promise<KycWebhookHandleResult>;

  /** Process a verified Identity webhook event (after signature verification). */
  handleIdentityEvent(event: Stripe.Event): Promise<KycWebhookHandleResult>;

  /** Pure helper used by middleware: throws KycRequiredError when the user is
   * over threshold and not approved.
   */
  enforceThreshold(userId: string): Promise<void>;
}
