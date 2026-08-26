/** Subset of KYC feedback used for CTA label copy (bid errors, callouts). */
export type KycLinkActionFeedback = {
  needsResubmit?: boolean;
  action?: "none" | "continue" | "retry" | "wait" | "start";
};

export type KycActionCopyKey = "wait" | "continue" | "retry" | "start" | "none";

export const KYC_ACTION_COPY = {
  wait: {
    short: "In review",
    long: "Verification in review",
    bid: "In review",
    onboarding: "View verification status",
  },
  continue: {
    short: "Continue",
    long: "Continue verification",
    bid: "Continue verification",
    onboarding: "Continue verification",
  },
  retry: {
    short: "Retry",
    long: "Try again",
    bid: "Try verification again",
    onboarding: "Try again",
  },
  start: {
    short: "Verify",
    long: "Verify to continue bidding",
    bid: "Start identity verification",
    onboarding: "Verify now",
  },
  none: {
    short: "Unavailable",
    long: "Action unavailable",
    bid: "Action unavailable",
    onboarding: "View verification status",
  },
} as const;

export function resolveKycActionCopyKey(
  feedback: KycLinkActionFeedback | null | undefined,
): KycActionCopyKey {
  if (feedback?.needsResubmit || feedback?.action === "continue") return "continue";
  if (feedback?.action === "retry") return "retry";
  if (feedback?.action === "wait") return "wait";
  if (feedback?.action === "none") return "none";
  return "start";
}

export function kycLinkActionLabel(
  feedback: KycLinkActionFeedback | null | undefined,
  variant: "short" | "long" = "long",
): string {
  return KYC_ACTION_COPY[resolveKycActionCopyKey(feedback)][variant];
}

export function kycBidActionLabel(
  feedback: KycLinkActionFeedback | null | undefined,
  variant: "short" | "bid" = "bid",
): string {
  return KYC_ACTION_COPY[resolveKycActionCopyKey(feedback)][variant];
}

export function kycOnboardingStartLabel(
  feedback: KycLinkActionFeedback | null | undefined,
  hardGate: boolean,
): string {
  const key = resolveKycActionCopyKey(feedback);
  if (key === "start" && hardGate) return KYC_ACTION_COPY.start.long;
  return KYC_ACTION_COPY[key].onboarding;
}
