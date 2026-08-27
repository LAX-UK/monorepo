"use client";

import { useBidConfirmation } from "@/hooks/lot-bid/use-bid-confirmation";
import { useBidEntryState } from "@/hooks/lot-bid/use-bid-entry-state";
import { useBidReview } from "@/hooks/lot-bid/use-bid-review";
import { useIdempotencyKey } from "@/hooks/lot-bid/use-idempotency-key";
import type { UsePlaceBidParams } from "@/hooks/lot-bid/use-place-bid.types";
import { sendVerificationEmailForReturnPath } from "@/lib/auth/services/send-verification-email.service";
import { deriveBidPanelFlags } from "@/lib/bid/derive-bid-panel-flags";
import { evaluateManualBidEligibility } from "@/lib/bid/evaluate-lot-bid-eligibility";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import { lotPath } from "@/lib/seo/url";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { notify } from "@/lib/ui/notify";
import { useCallback, useMemo, useState } from "react";

export type { UsePlaceBidParams } from "@/hooks/lot-bid/use-place-bid.types";

export function usePlaceBid(params: UsePlaceBidParams) {
  const {
    auction,
    sessionUser,
    initialAutoBidSettings = null,
    initialOutbid = false,
    omitPricingHeader = false,
    loginNextPath,
    saleRegistrationBidGate = null,
    saleForLifecycle = null,
    isOwnLot = false,
    currentPrice,
    leadingBidderId,
    activeAutoBid,
    position,
    lifecycle,
    countdownClock,
    biddingLive,
    isLotOnBlock,
    biddingAllowed,
    realtimeHealthy,
    applyOwnBidResult,
    scrollToBid,
    scrollToAutoBid,
    handleAutoBidSaved,
    markLotEndedLocally,
    setActiveAutoBid,
    bidWriter,
    refreshFromServer,
  } = params;

  const [feedbackError, setFeedbackError] = useState<BidErrorPresentation | null>(null);
  const { ensure: ensureConfirmIdempotencyKey, clear: clearConfirmAttempt } = useIdempotencyKey();

  const minNumeric = useMemo(
    () => getMinNextBidAmount(auction, currentPrice),
    [auction, currentPrice],
  );

  const entryState = useBidEntryState({
    auction,
    initialAutoBidSettings,
    initialOutbid,
    omitPricingHeader,
    activeAutoBid,
    position,
    scrollToBid,
    scrollToAutoBid,
    clearConfirmAttempt,
    applyOwnBidResult,
    handleAutoBidSaved,
    minNumeric,
  });

  const {
    amount,
    setAmount,
    maxAuto,
    setMaxAuto,
    entryMode,
    step,
    setStep,
    bidSuccess,
    setBidSuccess,
    useOnlineBidStepper,
    switchEntryMode,
    handleAutoBidDraft,
    onAutoBidSaved,
  } = entryState;

  const bidStepNumeric = useMemo(() => {
    const inc = Number.parseFloat(auction.minBidIncrement);
    return Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  }, [auction.minBidIncrement]);

  const loginNext = loginNextPath ?? lotPath(auction);

  const panelFlags = useMemo(
    () =>
      deriveBidPanelFlags({
        auction,
        position,
        lifecycle,
        countdownClock,
        isLotOnBlock,
        biddingLive,
        biddingAllowed,
        activeAutoBid,
        saleForLifecycle,
        switchEntryMode,
      }),
    [
      activeAutoBid,
      auction,
      biddingAllowed,
      biddingLive,
      countdownClock,
      isLotOnBlock,
      lifecycle,
      position,
      saleForLifecycle,
      switchEntryMode,
    ],
  );

  const {
    includeAutoBidOnManualBid,
    isWinning,
    englishOnlySurfaceLock,
    supportsAutoBid,
    autoBidEligible,
    showAutoBidExplainer,
    autoBidExplainerText,
    connectionBlocked,
    activeAutoBidNote,
  } = panelFlags;

  const manualBidEligibility = useMemo(
    () =>
      evaluateManualBidEligibility({
        isOwnLot,
        sessionUserId: sessionUser?.id ?? null,
        leadingBidderId,
      }),
    [isOwnLot, leadingBidderId, sessionUser?.id],
  );

  const manualBidBlockedReason = manualBidEligibility.ok ? null : manualBidEligibility.presentation;

  const displayedFeedback =
    feedbackError ??
    (entryMode === "manual" && manualBidBlockedReason ? manualBidBlockedReason : null);

  const handleFeedbackAction = useCallback(
    (actionKey: NonNullable<BidErrorPresentation["actionKey"]>) => {
      if (actionKey === "switch-to-auto-bid") {
        switchEntryMode("auto", { userInitiated: true });
        return;
      }
      if (actionKey === "resend-verification-email" && sessionUser) {
        void sendVerificationEmailForReturnPath({ email: sessionUser.email, next: loginNext }).then(
          (result) => {
            if (!result.ok) {
              notify.error(result.message);
              return;
            }
            notify.success("Verification email sent");
          },
        );
      }
    },
    [loginNext, sessionUser, switchEntryMode],
  );

  const { onReview } = useBidReview({
    amount,
    minNumeric,
    approvedBidLimit: saleRegistrationBidGate?.approvedBidLimit ?? null,
    includeAutoBidOnManualBid,
    activeAutoBidMax: activeAutoBid?.maxAutoBidAmount ?? null,
    biddingLive,
    biddingAllowed,
    manualBidEligibility,
    ensureConfirmIdempotencyKey,
    setStep,
    setFeedbackError,
    switchEntryMode,
  });

  const { submitting, onConfirm } = useBidConfirmation({
    auction,
    activeAutoBid,
    biddingLive,
    biddingAllowed,
    realtimeHealthy,
    refreshFromServer,
    bidWriter,
    applyOwnBidResult,
    markLotEndedLocally,
    setActiveAutoBid,
    kycSummary: params.kycSummary ?? null,
    saleRegistrationPath: params.saleRegistrationPath ?? null,
    loginNextPath,
    amount,
    minNumeric,
    ensureConfirmIdempotencyKey,
    clearConfirmAttempt,
    setStep,
    setAmount,
    setMaxAuto,
    setBidSuccess,
    setFeedbackError,
    switchEntryMode,
    includeAutoBidOnManualBid,
  });

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setFeedbackError(null);
  }, [minNumeric, setAmount]);

  return {
    amount,
    setAmount,
    maxAuto,
    setMaxAuto,
    entryMode,
    step,
    setStep,
    feedbackError,
    setFeedbackError,
    submitting,
    bidSuccess,
    minNumeric,
    bidStepNumeric,
    useOnlineBidStepper,
    loginNext,
    clearConfirmAttempt,
    includeAutoBidOnManualBid,
    isWinning,
    switchEntryMode,
    manualBidBlockedReason,
    displayedFeedback,
    handleFeedbackAction,
    handleAutoBidDraft,
    onAutoBidSaved,
    onReview,
    onConfirm,
    onUseMinimum,
    englishOnlySurfaceLock,
    supportsAutoBid,
    autoBidEligible,
    showAutoBidExplainer,
    autoBidExplainerText,
    connectionBlocked,
    activeAutoBidNote,
  };
}
