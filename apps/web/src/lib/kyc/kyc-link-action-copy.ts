/** Subset of KYC feedback used for CTA label copy (bid errors, callouts). */
export type KycLinkActionFeedback = {
  needsResubmit?: boolean;
  action?: "none" | "continue" | "retry" | "wait" | "start";
};

export function kycLinkActionLabel(
  feedback: KycLinkActionFeedback | null | undefined,
  variant: "short" | "long" = "long",
): string {
  if (feedback?.needsResubmit || feedback?.action === "continue") {
    return variant === "short" ? "Continue" : "Continue verification";
  }
  if (feedback?.action === "retry") return variant === "short" ? "Retry" : "Try again";
  if (feedback?.action === "wait") {
    return variant === "short" ? "In review" : "Verification in review";
  }
  return variant === "short" ? "Verify" : "Verify identity";
}
