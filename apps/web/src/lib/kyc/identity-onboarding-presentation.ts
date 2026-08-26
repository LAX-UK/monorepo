import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import type { IdentityOnboardingSource } from "@/lib/kyc/identity-onboarding";
import { kycOnboardingStartLabel } from "@/lib/kyc/kyc-link-action-copy";

type IdentityOnboardingPresentation = {
  title: string;
  message: string;
  detail: string;
  showPreparation: boolean;
  showProgress: boolean;
};

const CONTEXTUAL_HARD_GATE_SOURCES = new Set<IdentityOnboardingSource>([
  "bid_gate",
  "registration",
  "telephone",
  "condition_report",
]);

function isContextualHardGate(source: IdentityOnboardingSource): boolean {
  return CONTEXTUAL_HARD_GATE_SOURCES.has(source);
}

export function resolveIdentitySkipLabel(source: IdentityOnboardingSource): string | null {
  return isContextualHardGate(source) ? null : "Verify later";
}

export function resolveIdentityVerifySkipLabel(source: IdentityOnboardingSource): string | null {
  return isContextualHardGate(source) ? null : "Finish later";
}

export function resolveIdentityVerifyDescription(source: IdentityOnboardingSource): string {
  if (isContextualHardGate(source)) {
    return "Complete the secure Veriff document and selfie checks to continue.";
  }
  return "Complete the secure Veriff document and selfie checks. You can finish later and resume without losing your place.";
}

export function resolveIdentityStartButtonLabel(
  source: IdentityOnboardingSource,
  summary: KycStatusSummaryDto | null,
): string {
  const feedback =
    summary?.status === "pending"
      ? { ...summary.feedback, action: "wait" as const, needsResubmit: false }
      : summary?.status === "rejected"
        ? { ...summary.feedback, action: "retry" as const }
        : summary?.feedback;
  return kycOnboardingStartLabel(feedback, isContextualHardGate(source));
}

export function resolveIdentityOnboardingPresentation(
  summary: KycStatusSummaryDto | null,
  source: IdentityOnboardingSource,
  hasContextLot: boolean,
): IdentityOnboardingPresentation {
  if (summary?.feedback.action === "wait" || summary?.status === "pending") {
    return {
      title: "Verification in progress",
      message: "Your identity check is being reviewed.",
      detail:
        summary.feedback.detail ?? "We’ll update your account as soon as the review is complete.",
      showPreparation: false,
      showProgress: false,
    };
  }

  if (summary?.feedback.needsResubmit || summary?.feedback.action === "retry") {
    return {
      title: "Let’s verify your identity again",
      message: summary.feedback.headline,
      detail:
        summary.feedback.detail ??
        "Have your photo ID ready and follow the secure verification steps.",
      showPreparation: true,
      showProgress: false,
    };
  }

  if (summary?.feedback.action === "continue" || summary?.latestSessionStatus === "created") {
    return {
      title: "Continue your identity verification",
      message: "Your secure identity check is already started.",
      detail: "Continue where you left off. Your progress is saved.",
      showPreparation: false,
      showProgress: false,
    };
  }

  if (isContextualHardGate(source)) {
    return {
      title: "Verify to continue",
      message: "Identity verification is required before you can complete this action.",
      detail: "~2 minutes · photo ID and a quick selfie · processed securely by Veriff",
      showPreparation: true,
      showProgress: false,
    };
  }

  const isFullBuyerFlow = source === "post_verify" || source === "sign_in_resume";

  if (isFullBuyerFlow && hasContextLot) {
    return {
      title: "One step from bidding on",
      message:
        "LAX verifies every bidder — it’s what keeps the room trusted and your bids protected.",
      detail: "~2 minutes · you’ll need your photo ID and a quick selfie",
      showPreparation: true,
      showProgress: true,
    };
  }

  return {
    title: "Verify your identity",
    message: "Complete a quick identity check to unlock secure bidding.",
    detail: "~2 minutes · you’ll need your photo ID and a quick selfie",
    showPreparation: true,
    showProgress: isFullBuyerFlow,
  };
}
