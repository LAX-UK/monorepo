import type { LotBidEligibilityResult } from "@/lib/bid/evaluate-lot-bid-eligibility";
import {
  validateBidReview,
  validateLiveBiddingConnectionBlocked,
} from "@/lib/bid/validate-bid-entry";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { BID_ERROR_CODES } from "@/lib/ui/bid-error/codes";
import { useCallback } from "react";

export type UseBidReviewParams = {
  amount: string;
  minNumeric: number;
  approvedBidLimit?: number | null | undefined;
  includeAutoBidOnManualBid: boolean;
  activeAutoBidMax?: string | null;
  biddingLive: boolean;
  biddingAllowed: boolean;
  manualBidEligibility: LotBidEligibilityResult;
  ensureConfirmIdempotencyKey: () => string;
  setStep: (step: 1 | 2) => void;
  setFeedbackError: (error: BidErrorPresentation | null) => void;
  switchEntryMode: (mode: "manual" | "auto", opts?: { userInitiated?: boolean }) => void;
};

export function useBidReview({
  amount,
  minNumeric,
  approvedBidLimit,
  includeAutoBidOnManualBid,
  activeAutoBidMax,
  biddingLive,
  biddingAllowed,
  manualBidEligibility,
  ensureConfirmIdempotencyKey,
  setStep,
  setFeedbackError,
  switchEntryMode,
}: UseBidReviewParams) {
  const onReview = useCallback(() => {
    setFeedbackError(null);
    if (!manualBidEligibility.ok) {
      setFeedbackError(manualBidEligibility.presentation);
      if (manualBidEligibility.code === BID_ERROR_CODES.already_leading) {
        switchEntryMode("auto", { userInitiated: true });
      }
      return;
    }

    const connectionBlocked = validateLiveBiddingConnectionBlocked(biddingLive, biddingAllowed);
    if (connectionBlocked && !connectionBlocked.ok) {
      setFeedbackError(connectionBlocked.error);
      return;
    }

    const validation = validateBidReview({
      amount,
      minNumeric,
      approvedBidLimit: approvedBidLimit ?? null,
      includeAutoBidOnManualBid,
      activeAutoBidMax: activeAutoBidMax ?? null,
    });
    if (!validation.ok) {
      setFeedbackError(validation.error);
      return;
    }

    ensureConfirmIdempotencyKey();
    setStep(2);
  }, [
    amount,
    minNumeric,
    approvedBidLimit,
    includeAutoBidOnManualBid,
    activeAutoBidMax,
    biddingLive,
    biddingAllowed,
    manualBidEligibility,
    ensureConfirmIdempotencyKey,
    setStep,
    setFeedbackError,
    switchEntryMode,
  ]);

  return { onReview };
}
