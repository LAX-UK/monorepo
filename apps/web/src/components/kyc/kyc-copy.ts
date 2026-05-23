import type { UserKycStatus } from "@auction/types";

export const KYC_PROVIDER_NAME = "Veriff";

export type KycUiPhase =
  | "idle"
  | "starting"
  | "in_flow"
  | "submitted"
  | "processing"
  | "approved"
  | "rejected"
  | "needs_resubmit";

export function kycStatusLabel(status: UserKycStatus, requiresKyc: boolean): string {
  switch (status) {
    case "approved":
      return "Verified";
    case "pending":
      return "In review";
    case "rejected":
      return "Rejected";
    default:
      return requiresKyc ? "Required" : "Not verified";
  }
}

export function kycStatusHint(status: UserKycStatus, phase: KycUiPhase): string {
  if (phase === "in_flow") {
    return "Complete document and selfie checks in the secure window.";
  }
  if (phase === "submitted" || phase === "processing") {
    return "We are processing your verification. This usually takes a few minutes.";
  }
  if (status === "rejected") {
    return "Verification was not successful. You can try again with clearer documents.";
  }
  if (status === "approved") {
    return "Your identity has been verified. You can bid and register for sales.";
  }
  return "Required when your bidding exposure reaches our verification threshold.";
}

export function kycVerifyButtonLabel(phase: KycUiPhase, busy: boolean): string {
  if (busy || phase === "starting") return "Starting…";
  if (phase === "in_flow") return "Verification in progress…";
  if (phase === "submitted" || phase === "processing") return "Processing…";
  if (phase === "needs_resubmit" || phase === "rejected") return "Try again";
  return "Start verification";
}

export const KYC_VERIFY_DESCRIPTION =
  "Complete a secure document and selfie check with Veriff. You can finish in a few minutes without leaving this page.";

export const KYC_BANNER_DESCRIPTION =
  "Complete identity verification to keep bidding and settle outstanding commitments.";

export const KYC_BID_BLOCKED_DESCRIPTION =
  "Identity verification is required before you can place bids at your current exposure.";

/** Dashboard attention list hint when threshold KYC is required. */
export const KYC_ATTENTION_REQUIRED_HINT =
  "Required when your bidding exposure reaches our verification threshold.";

/**
 * KYC gating models:
 * - Threshold (`requiresKyc`): bid placement when exposure >= KYC_THRESHOLD_AMOUNT.
 * - Hard approved: saleroom registration, condition reports, org onboarding submit.
 */
