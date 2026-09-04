import type { MarketingEvent } from "@auction/types";
import type { KycVerification, UserKycStatus } from "@auction/types";
import type { KycUserFeedback } from "./kyc-user-feedback.js";

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
  /** Raw DB `bid_user_profile.kycStatus`. UI must use `feedback` + `latestSessionStatus` (or frontend helpers). */
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
