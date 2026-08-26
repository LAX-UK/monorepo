import type { BidBlockerPresentation } from "@/lib/bid/bid-blocker-presentation";
import type { KycUserFeedbackDto } from "@/lib/data/dto/dashboard-dtos";
import { KYC_ACTION_COPY, resolveKycActionCopyKey } from "@/lib/kyc/kyc-link-action-copy";

const BIDDING_PREVIEW =
  "After approval, you can place a one-time bid or set an auto-bid on this lot.";

const KYC_BID_BLOCKED_DESCRIPTION =
  "Identity verification is required before you can place bids at your current exposure.";

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
      action: {
        kind: "status",
        label: KYC_ACTION_COPY.wait.bid,
        shortLabel: KYC_ACTION_COPY.wait.short,
      },
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
        label: KYC_ACTION_COPY.continue.bid,
        shortLabel: KYC_ACTION_COPY.continue.short,
      },
      preview: BIDDING_PREVIEW,
    };
  }

  if (feedback?.action === "retry") {
    return {
      tone: "danger",
      title: feedback.headline || "Identity verification was not approved",
      detail: feedback.detail ?? "Review the verification guidance and submit your details again.",
      action: {
        kind: "link",
        href,
        label: KYC_ACTION_COPY.retry.bid,
        shortLabel: KYC_ACTION_COPY.retry.short,
      },
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
        label: KYC_ACTION_COPY.none.bid,
        shortLabel: KYC_ACTION_COPY.none.short,
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
      label: KYC_ACTION_COPY[resolveKycActionCopyKey(feedback)].bid,
      shortLabel: KYC_ACTION_COPY.start.short,
    },
    preview: BIDDING_PREVIEW,
  };
}
