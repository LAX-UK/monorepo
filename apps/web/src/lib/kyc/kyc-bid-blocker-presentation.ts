import { KYC_BID_BLOCKED_DESCRIPTION } from "@/components/kyc/kyc-copy";
import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";

const BIDDING_PREVIEW =
  "After approval, you can place a one-time bid or set an auto-bid on this lot.";

type KycBidBlockerInput = {
  href: string;
  strict: boolean;
  feedback?:
    | (Pick<KycUserFeedbackDto, "needsResubmit" | "action"> &
        Partial<Pick<KycUserFeedbackDto, "headline" | "detail">>)
    | null
    | undefined;
};

export function resolveKycBidBlockerPresentation({
  href,
  strict,
  feedback,
}: KycBidBlockerInput): BidBlockerPresentation {
  if (feedback?.action === "wait") {
    return {
      tone: "info",
      title: feedback.headline || "Identity verification in review",
      detail:
        feedback.detail ??
        "Your verification is being reviewed. You can bid as soon as it is approved.",
      action: { kind: "status", label: "In review", shortLabel: "In review" },
      preview: BIDDING_PREVIEW,
    };
  }

  if (feedback?.needsResubmit || feedback?.action === "continue") {
    return {
      tone: "warning",
      title: feedback.headline || "Continue identity verification",
      detail:
        feedback.detail ??
        "Complete the remaining document and selfie checks before placing a bid.",
      action: {
        kind: "link",
        href,
        label: "Continue verification",
        shortLabel: "Continue",
      },
      preview: BIDDING_PREVIEW,
    };
  }

  if (feedback?.action === "retry") {
    return {
      tone: "danger",
      title: feedback.headline || "Identity verification was not approved",
      detail: feedback.detail ?? "Review the verification guidance and submit your details again.",
      action: { kind: "link", href, label: "Try verification again", shortLabel: "Try again" },
      preview: BIDDING_PREVIEW,
    };
  }

  if (feedback?.action === "none") {
    return {
      tone: "warning",
      title: feedback.headline || "Identity verification unavailable",
      detail:
        feedback.detail ??
        "There is no verification action available right now. Contact support if this persists.",
      action: {
        kind: "status",
        label: "Action unavailable",
        shortLabel: "Unavailable",
      },
      preview: BIDDING_PREVIEW,
    };
  }

  return {
    tone: "warning",
    title: feedback?.headline || "Identity verification required",
    detail:
      feedback?.detail ??
      (strict
        ? "Your identity must be approved before you can place bids."
        : KYC_BID_BLOCKED_DESCRIPTION),
    action: {
      kind: "link",
      href,
      label: "Start identity verification",
      shortLabel: "Verify",
    },
    preview: BIDDING_PREVIEW,
  };
}
