import type { MarketingEvent } from "@auction/types";
import type { KycVerification, UserKycStatus } from "@auction/types";
import type { KycUserFeedback } from "../kyc/kyc-user-feedback.js";

export type { KycFeedbackAction, KycUserFeedback } from "../kyc/kyc-user-feedback.js";

export type CreateKycSessionResult = {
  /** Provider session id (Veriff UUID). */
  sessionId: string;
  /** URL for InContext SDK or redirect fallback. */
  verificationUrl: string;
  verification: KycVerification;
};

export type KycWebhookHandleResult = {
  verification: KycVerification | null;
  /** True when this delivery updated user KYC columns (not a stale session / no-op branch). */
  appliedUserKycUpdate: boolean;
  /** True when the *current* session was approved — run post-verification progression. */
  shouldProgressIndividuals: boolean;
  /** Staged in the same transaction as KYC approval; enqueue after handleWebhook returns. */
  marketingEventToEnqueue?: MarketingEvent;
  /** Notify the user to resubmit after Veriff requested more input. */
  resubmissionNotify?: {
    userId: string;
    providerSessionId: string;
    providerAttemptId: string | null;
    feedback: KycUserFeedback;
  };
};

export type KycStatusSummary = {
  /** Raw DB `user.kycStatus`. UI must use `feedback` + `latestSessionStatus` (or frontend helpers). */
  status: UserKycStatus;
  verifiedAt: Date | null;
  latestSessionId: string | null;
  latestSessionStatus: KycVerification["status"] | null;
  feedback: KycUserFeedback;
  pendingExposure: { total: number; currency: string };
  thresholdAmount: number;
  thresholdCurrency: string;
  /** True when KYC is required *now* — i.e. exposure >= threshold and the
   * user is not yet `approved`.
   */
  requiresKyc: boolean;
};

export class KycNotConfiguredError extends Error {
  constructor() {
    super("kyc_not_configured: set VERIFF_API_KEY and VERIFF_SHARED_SECRET to enable KYC");
    this.name = "KycNotConfiguredError";
  }
}

export class KycAlreadyApprovedError extends Error {
  readonly status = 409;
  readonly code = "kyc_already_approved";
  constructor() {
    super("kyc_already_approved");
    this.name = "KycAlreadyApprovedError";
  }
}

export class VeriffWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VeriffWebhookPayloadError";
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
  isConfigured(): boolean;
  createSession(userId: string, returnUrl: string): Promise<CreateKycSessionResult>;
  getLatestForUser(userId: string): Promise<KycVerification | null>;
  getStatus(userId: string): Promise<KycStatusSummary>;
  handleDecisionWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<KycWebhookHandleResult>;
  handleEventWebhook(
    rawBody: string,
    signature: string | undefined,
    authClient: string | undefined,
  ): Promise<void>;
  enforceThreshold(userId: string): Promise<void>;
}
