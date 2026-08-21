import type { KycStatusSummaryDto, KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { type KycLinkActionFeedback, kycLinkActionLabel } from "@/lib/kyc/kyc-link-action-copy";

export { kycLinkActionLabel, type KycLinkActionFeedback };

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

const DEFAULT_FEEDBACK: KycUserFeedbackDto = {
  headline: "Not verified",
  detail: "Required when your bidding exposure reaches our verification threshold.",
  action: "start",
  reasonCode: null,
  decisionStatus: null,
  needsResubmit: false,
};

export function resolveKycFeedback(summary: KycStatusSummaryDto | null): KycUserFeedbackDto {
  return summary?.feedback ?? DEFAULT_FEEDBACK;
}

export function kycStatusLabel(
  summary: KycStatusSummaryDto | null,
  phase: KycUiPhase = "idle",
): string {
  const feedback = resolveKycFeedback(summary);
  if (summary?.latestSessionStatus === "created") return "Verification started";
  if (phase === "submitted" || phase === "processing") return "In review";
  if (phase === "in_flow") return "Verification in progress";
  if (phase === "needs_resubmit") return feedback.headline;
  return feedback.headline;
}

export function kycStatusHint(summary: KycStatusSummaryDto | null, phase: KycUiPhase): string {
  const feedback = resolveKycFeedback(summary);

  if (summary?.latestSessionStatus === "created") {
    return "Complete the document and selfie checks in the secure window.";
  }
  if (phase === "in_flow") {
    return "Complete document and selfie checks in the secure window.";
  }
  if (phase === "submitted" || phase === "processing") {
    return "We are processing your verification. This usually takes a few minutes.";
  }
  if (feedback.detail) return feedback.detail;
  return "Required when your bidding exposure reaches our verification threshold.";
}

export function kycInitialPhase(summary: KycStatusSummaryDto | null): KycUiPhase {
  if (summary?.status === "approved") return "approved";
  if (summary?.feedback?.needsResubmit) return "needs_resubmit";
  if (summary?.latestSessionStatus === "created") return "idle";
  if (summary?.status === "pending") return "processing";
  if (summary?.status === "rejected") return "rejected";
  return "idle";
}

const ACTIVE_CLIENT_PHASES = new Set<KycUiPhase>(["starting", "in_flow", "submitted"]);

/** Whether the user may start or continue a Veriff session from the launcher. */
export function canStartKycVerification(
  summary: KycStatusSummaryDto | null,
  phase: KycUiPhase,
): boolean {
  if (summary?.status === "approved") return false;
  const feedback = resolveKycFeedback(summary);
  if (feedback.action === "none") return false;
  if (feedback.action === "continue") return true;
  if (summary?.latestSessionStatus === "created") return true;
  if (feedback.action === "wait") return false;
  if (summary?.status === "pending" && summary.latestSessionStatus === "processing") return false;
  if (summary?.status === "pending" && !ACTIVE_CLIENT_PHASES.has(phase)) return false;
  if (phase === "submitted" || phase === "processing") return false;
  return true;
}

/** Merge server-derived phase with in-flow client phases for labels and busy state. */
export function effectiveKycPhase(
  summary: KycStatusSummaryDto | null,
  clientPhase: KycUiPhase,
): KycUiPhase {
  if (ACTIVE_CLIENT_PHASES.has(clientPhase)) return clientPhase;
  return kycInitialPhase(summary);
}

export function kycVerifyButtonLabel(
  summary: KycStatusSummaryDto | null,
  phase: KycUiPhase,
  busy: boolean,
): string {
  const action = resolveKycFeedback(summary).action;
  if (busy || phase === "starting") return "Starting…";
  if (phase === "in_flow") return "Verification in progress…";
  if (phase === "submitted" || phase === "processing") return "Processing…";
  if (phase === "needs_resubmit" || action === "continue") return "Continue verification";
  if (phase === "rejected" || action === "retry") return "Try again";
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

export const KYC_FLOW_CANCELED_MESSAGE =
  "Verification was canceled. You can continue when you are ready.";

export type KycCompliancePillTone = "ok" | "warn" | "danger" | "info";

export type KycComplianceIdentityPill = {
  value: string;
  tone: KycCompliancePillTone;
  hint?: string;
};

/**
 * User-facing KYC UX must not branch on raw `summary.status` alone — use these helpers
 * with `feedback` and `latestSessionStatus`. Raw DB status may lag session lifecycle.
 */

/** True when Veriff is reviewing a submitted session (not a created/in-flow session). */
export function isKycInReview(summary: KycStatusSummaryDto | null): boolean {
  if (!summary) return false;
  if (summary.latestSessionStatus === "created") return false;
  const feedback = resolveKycFeedback(summary);
  if (feedback.action === "wait") return true;
  return summary.status === "pending" && summary.latestSessionStatus === "processing";
}

/** True when the user may resume an open Veriff session without starting over. */
export function isKycSessionContinuable(summary: KycStatusSummaryDto | null): boolean {
  if (!summary) return false;
  const feedback = resolveKycFeedback(summary);
  if (feedback.action === "continue") return true;
  return summary.latestSessionStatus === "created";
}

/** True when ?kyc=complete should advance the client to submitted/processing UX. */
export function isKycAwaitingDecision(summary: KycStatusSummaryDto | null): boolean {
  if (!summary) return false;
  return (
    summary.latestSessionStatus === "processing" ||
    (summary.status === "pending" && summary.latestSessionStatus !== "created")
  );
}

/** Dashboard compliance strip Identity pill label, tone, and optional hint. */
export function kycComplianceIdentityPill(
  summary: KycStatusSummaryDto | null,
): KycComplianceIdentityPill {
  if (!summary) {
    return { value: "Not verified", tone: "info" };
  }

  const feedback = resolveKycFeedback(summary);

  if (summary.status === "approved") {
    return { value: "Verified", tone: "ok" };
  }
  if (feedback.needsResubmit) {
    return {
      value: "Action needed",
      tone: "warn",
      hint: feedback.detail ?? "Complete the missing verification checks",
    };
  }
  if (isKycInReview(summary)) {
    return { value: "In review", tone: "info" };
  }
  if (isKycSessionContinuable(summary)) {
    return {
      value: "Started",
      tone: "warn",
      hint: feedback.detail ?? "Complete the document and selfie checks in the secure window.",
    };
  }
  if (summary.status === "rejected") {
    return {
      value: "Rejected",
      tone: "danger",
      hint: feedback.detail ?? "Please resubmit your identity documents",
    };
  }
  if (summary.requiresKyc) {
    return { value: "Required", tone: "warn" };
  }
  return { value: "Not verified", tone: "info" };
}

/**
 * KYC gating models:
 * - Threshold (`requiresKyc`): bid placement when exposure >= KYC_THRESHOLD_AMOUNT.
 * - Hard approved: saleroom registration, condition reports, org onboarding submit.
 */
