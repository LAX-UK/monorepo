import type { UsePlaceBidParams } from "@/hooks/lot-bid/use-place-bid.types";
import { mapBidResultError } from "@/lib/bid/map-bid-result-error";
import { refreshBeforeSubmitIfNeeded } from "@/lib/bid/refresh-before-submit";
import { validateLiveBiddingConnectionBlocked } from "@/lib/bid/validate-bid-entry";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import type { BidErrorPresentation } from "@/lib/ui/bid-error";
import { clientBidError } from "@/lib/ui/bid-error";
import { BID_ERROR_CODES } from "@/lib/ui/bid-error/codes";
import { shouldStayOnBidConfirmStep } from "@/lib/ui/bid-error/confirm-step";
import { useCallback, useState } from "react";

export type UseBidConfirmationParams = Pick<
  UsePlaceBidParams,
  | "auction"
  | "activeAutoBid"
  | "biddingLive"
  | "biddingAllowed"
  | "realtimeHealthy"
  | "refreshFromServer"
  | "bidWriter"
  | "applyOwnBidResult"
  | "markLotEndedLocally"
  | "setActiveAutoBid"
  | "kycSummary"
  | "saleRegistrationPath"
  | "loginNextPath"
> & {
  amount: string;
  minNumeric: number;
  ensureConfirmIdempotencyKey: () => string;
  clearConfirmAttempt: () => void;
  setStep: (step: 1 | 2) => void;
  setAmount: (value: string) => void;
  setMaxAuto: (value: string) => void;
  setBidSuccess: (value: boolean) => void;
  setFeedbackError: (error: BidErrorPresentation | null) => void;
  switchEntryMode: (mode: "manual" | "auto", opts?: { userInitiated?: boolean }) => void;
  includeAutoBidOnManualBid: boolean;
};

export function useBidConfirmation({
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
  kycSummary,
  saleRegistrationPath,
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
}: UseBidConfirmationParams) {
  const [submitting, setSubmitting] = useState(false);

  const onConfirm = useCallback(async () => {
    setFeedbackError(null);

    const connectionBlocked = validateLiveBiddingConnectionBlocked(biddingLive, biddingAllowed);
    if (connectionBlocked && !connectionBlocked.ok) {
      setFeedbackError(connectionBlocked.error);
      return;
    }

    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setFeedbackError(clientBidError("Invalid amount"));
      return;
    }

    const savedMax = activeAutoBid?.maxAutoBidAmount ?? "";
    const maxN =
      includeAutoBidOnManualBid && savedMax.trim() !== "" ? Number.parseFloat(savedMax) : undefined;
    const savedStep = activeAutoBid?.autoBidStepAmount ?? "";
    const stepN =
      includeAutoBidOnManualBid && savedStep.trim() !== ""
        ? Number.parseFloat(savedStep)
        : undefined;

    const refreshResult = await refreshBeforeSubmitIfNeeded({
      biddingLive,
      biddingAllowed,
      realtimeHealthy,
      refresh: refreshFromServer,
    });
    if (!refreshResult.ok) {
      setFeedbackError(refreshResult.error);
      return;
    }

    if (n + 1e-9 < minNumeric) {
      setFeedbackError(clientBidError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`));
      clearConfirmAttempt();
      setStep(1);
      return;
    }

    setSubmitting(true);
    let result: Awaited<ReturnType<typeof bidWriter.placeBid>>;
    try {
      result = await bidWriter.placeBid({
        lotId: auction.id,
        amount: n,
        idempotencyKey: ensureConfirmIdempotencyKey(),
        ...(maxN !== undefined && !Number.isNaN(maxN)
          ? {
              maxAutoBidAmount: maxN,
              ...(stepN !== undefined && !Number.isNaN(stepN) ? { autoBidStepAmount: stepN } : {}),
            }
          : {}),
      });
    } catch {
      setFeedbackError(
        clientBidError("Could not reach the server. Check your connection and try again."),
      );
      return;
    } finally {
      setSubmitting(false);
    }

    const loginNext = loginNextPath ?? lotPath(auction);

    if (!result.ok) {
      const mapped = mapBidResultError({
        error: result.error,
        verifyReturnPath: loginNext,
        lotId: auction.id,
        code: result.code ?? null,
        ...(saleRegistrationPath ? { saleRegistrationPath } : {}),
        kycFeedback: result.kycFeedback ?? kycSummary?.feedback ?? null,
      });
      setFeedbackError(mapped);
      if (
        result.code === BID_ERROR_CODES.already_leading ||
        result.error.includes("already the highest")
      ) {
        switchEntryMode("auto", { userInitiated: true });
      }
      if (!shouldStayOnBidConfirmStep(result.code ?? null, result.error)) {
        clearConfirmAttempt();
        setStep(1);
      }
      return;
    }

    clearConfirmAttempt();
    applyOwnBidResult(result.bid);
    if (!result.bid.maxAutoBidAmount) {
      setActiveAutoBid(null);
      setMaxAuto("");
    }
    setAmount("");
    setStep(1);
    setBidSuccess(true);

    const buyNow =
      auction.auctionType === "buy_it_now" &&
      auction.buyNowPrice !== null &&
      auction.buyNowPrice !== ""
        ? Number(auction.buyNowPrice)
        : null;
    const hitBuyNow =
      buyNow !== null && Number.isFinite(buyNow) && Number(result.bid.amount) + 1e-9 >= buyNow;
    if (auction.auctionType === "dutch" || hitBuyNow) {
      markLotEndedLocally(
        auction.auctionType === "dutch"
          ? "Sale complete — this Dutch lot has closed."
          : "Buy now — this lot has sold at the buy-now price.",
      );
    }
  }, [
    amount,
    applyOwnBidResult,
    auction,
    bidWriter,
    clearConfirmAttempt,
    ensureConfirmIdempotencyKey,
    activeAutoBid?.autoBidStepAmount,
    activeAutoBid?.maxAutoBidAmount,
    includeAutoBidOnManualBid,
    switchEntryMode,
    kycSummary?.feedback,
    loginNextPath,
    markLotEndedLocally,
    minNumeric,
    saleRegistrationPath,
    setActiveAutoBid,
    setAmount,
    setBidSuccess,
    setFeedbackError,
    setMaxAuto,
    setStep,
    biddingAllowed,
    biddingLive,
    realtimeHealthy,
    refreshFromServer,
  ]);

  return { submitting, onConfirm };
}
