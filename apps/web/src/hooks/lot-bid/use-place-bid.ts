"use client";

import type { UseLotBidStateResult } from "@/hooks/use-lot-bid-state";
import type { LotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import { evaluateManualBidEligibility } from "@/lib/bid/evaluate-lot-bid-eligibility";
import { type LotBidEntryMode, defaultLotBidEntryMode } from "@/lib/bid/lot-bid-entry-mode";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import type {
  AutoBidPlacedBid,
  AutoBidSettings,
  BidWriter,
  SessionUser,
} from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { formatMoney } from "@/lib/format-currency";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import { BID_ERROR_CODES } from "@/lib/ui/bid-error/codes";
import { shouldStayOnBidConfirmStep } from "@/lib/ui/bid-error/confirm-step";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UsePlaceBidParams = {
  auction: Lot | PublicLotView;
  sessionUser: SessionUser | null;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  omitPricingHeader?: boolean;
  loginNextPath?: string | undefined;
  kycSummary?: KycStatusSummaryDto | null;
  saleRegistrationBidGate?: SaleRegistrationBidGateContext | null;
  saleRegistrationPath?: string | null;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
  isOwnLot?: boolean;
  currentPrice: string;
  leadingBidderId: string | null;
  activeAutoBid: AutoBidSettings | null;
  position: LotBidPosition;
  lifecycle: LotLifecycle;
  countdownClock: string;
  biddingLive: boolean;
  isLotOnBlock: boolean;
  biddingAllowed: boolean;
  realtimeHealthy: boolean;
  applyOwnBidResult: UseLotBidStateResult["applyOwnBidResult"];
  scrollToBid: () => void;
  scrollToAutoBid: () => void;
  handleAutoBidSaved: (settings: AutoBidSettings | null) => void;
  markLotEndedLocally: (banner: string) => void;
  setActiveAutoBid: (settings: AutoBidSettings | null) => void;
  bidWriter: BidWriter;
  refreshFromServer: () => Promise<{ ok: boolean }>;
};

export function usePlaceBid({
  auction,
  sessionUser,
  initialAutoBidSettings = null,
  initialOutbid = false,
  omitPricingHeader = false,
  loginNextPath,
  kycSummary = null,
  saleRegistrationBidGate = null,
  saleRegistrationPath = null,
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
}: UsePlaceBidParams) {
  const [amount, setAmount] = useState("");
  const [maxAuto, setMaxAuto] = useState(initialAutoBidSettings?.maxAutoBidAmount ?? "");
  const [entryMode, setEntryMode] = useState<LotBidEntryMode>(() =>
    defaultLotBidEntryMode({
      supportsAutoBid: auction.auctionType === "english" || auction.auctionType === "buy_it_now",
      hasActiveAutoBid: Boolean(initialAutoBidSettings?.isActive),
      userPreference: null,
    }),
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [feedbackError, setFeedbackError] = useState<BidErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const confirmIdempotencyKeyRef = useRef<string | null>(null);
  const userPickedModeRef = useRef(false);

  const minNumeric = useMemo(
    () => getMinNextBidAmount(auction, currentPrice),
    [auction, currentPrice],
  );

  const handleAutoBidDraft = useCallback(
    (draft: { maxAuto: string; step: string; dirty: boolean }) => {
      setMaxAuto(draft.maxAuto);
    },
    [],
  );

  const onAutoBidSaved = useCallback(
    (settings: AutoBidSettings | null, placedBid?: AutoBidPlacedBid) => {
      handleAutoBidSaved(settings);
      if (placedBid) {
        applyOwnBidResult(placedBid);
      }
      if (settings) {
        setMaxAuto(settings.maxAutoBidAmount);
      } else {
        setMaxAuto("");
      }
    },
    [applyOwnBidResult, handleAutoBidSaved],
  );

  useEffect(() => {
    if (!bidSuccess) return;
    const t = window.setTimeout(() => setBidSuccess(false), 4000);
    return () => window.clearTimeout(t);
  }, [bidSuccess]);

  const bidStepNumeric = useMemo(() => {
    const inc = Number.parseFloat(auction.minBidIncrement);
    return Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  }, [auction.minBidIncrement]);

  const useOnlineBidStepper =
    omitPricingHeader &&
    (auction.auctionType === "english" || auction.auctionType === "buy_it_now");

  useEffect(() => {
    if (!useOnlineBidStepper) return;
    if (amount.trim() !== "") return;
    setAmount(minNumeric.toFixed(2));
  }, [useOnlineBidStepper, minNumeric, amount]);

  const loginNext = loginNextPath ?? lotPath(auction);

  const clearConfirmAttempt = useCallback(() => {
    confirmIdempotencyKeyRef.current = null;
  }, []);

  const ensureConfirmIdempotencyKey = useCallback((): string => {
    if (!confirmIdempotencyKeyRef.current) {
      confirmIdempotencyKeyRef.current = crypto.randomUUID();
    }
    return confirmIdempotencyKeyRef.current;
  }, []);

  const includeAutoBidOnManualBid = Boolean(activeAutoBid?.isActive);

  const isWinning =
    position.kind === "winning" ||
    position.kind === "winningByAuto" ||
    position.kind === "leadingBelowReserve";

  const supportsAutoBidPanel =
    auction.auctionType === "english" || auction.auctionType === "buy_it_now";

  const switchEntryMode = useCallback(
    (mode: LotBidEntryMode, opts?: { userInitiated?: boolean }) => {
      if (opts?.userInitiated) userPickedModeRef.current = true;

      if (step !== 1) {
        clearConfirmAttempt();
        setStep(1);
      }

      if (mode === "manual" && amount.trim() === "") {
        setAmount(minNumeric.toFixed(2));
      }

      setEntryMode(mode);

      requestAnimationFrame(() => {
        if (mode === "auto") scrollToAutoBid();
        else scrollToBid();
      });
    },
    [amount, clearConfirmAttempt, minNumeric, scrollToAutoBid, scrollToBid, step],
  );

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
      }
    },
    [switchEntryMode],
  );

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (userPickedModeRef.current) return;
    if (initialOutbid) {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, initialOutbid, supportsAutoBidPanel]);

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (userPickedModeRef.current) return;
    if (position.kind === "outbid" || position.kind === "inRunning") {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, position.kind, supportsAutoBidPanel]);

  const onReview = useCallback(() => {
    setFeedbackError(null);
    if (!manualBidEligibility.ok) {
      setFeedbackError(manualBidEligibility.presentation);
      if (manualBidEligibility.code === "already_leading") {
        switchEntryMode("auto", { userInitiated: true });
      }
      return;
    }
    if (biddingLive && !biddingAllowed) {
      setFeedbackError(
        clientBidError(
          "Live bidding is unavailable until your connection to the saleroom is restored.",
        ),
      );
      return;
    }
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n + 1e-9 < minNumeric) {
      setFeedbackError(clientBidError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`));
      return;
    }
    const regLimit = saleRegistrationBidGate?.approvedBidLimit;
    if (regLimit != null && n > regLimit + 1e-9) {
      setFeedbackError(
        clientBidError(
          `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Enter a lower amount.`,
        ),
      );
      return;
    }
    const savedMax = activeAutoBid?.maxAutoBidAmount ?? "";
    const maxN =
      includeAutoBidOnManualBid && savedMax.trim() !== "" ? Number.parseFloat(savedMax) : undefined;
    if (maxN !== undefined) {
      if (Number.isNaN(maxN) || maxN < n) {
        setFeedbackError(clientBidError("Max auto-bid must be greater than or equal to your bid."));
        return;
      }
      if (regLimit != null && maxN > regLimit + 1e-9) {
        setFeedbackError(
          clientBidError(
            `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Lower your max auto-bid.`,
          ),
        );
        return;
      }
    }
    ensureConfirmIdempotencyKey();
    setStep(2);
  }, [
    amount,
    ensureConfirmIdempotencyKey,
    activeAutoBid?.maxAutoBidAmount,
    switchEntryMode,
    includeAutoBidOnManualBid,
    manualBidEligibility,
    minNumeric,
    saleRegistrationBidGate?.approvedBidLimit,
    biddingAllowed,
    biddingLive,
  ]);

  const onConfirm = useCallback(async () => {
    setFeedbackError(null);
    if (biddingLive && !biddingAllowed) {
      setFeedbackError(
        clientBidError(
          "Live bidding is unavailable until your connection to the saleroom is restored.",
        ),
      );
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
    if (biddingLive && biddingAllowed && !realtimeHealthy) {
      const refreshed = await refreshFromServer();
      if (!refreshed.ok) {
        setFeedbackError(
          clientBidError("Could not refresh live prices. Check your connection and try again."),
        );
        return;
      }
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
    if (!result.ok) {
      const mapped = mapBidError(result.error, {
        verifyReturnPath: loginNext,
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
    loginNext,
    markLotEndedLocally,
    minNumeric,
    saleRegistrationPath,
    setActiveAutoBid,
    biddingAllowed,
    biddingLive,
    realtimeHealthy,
    refreshFromServer,
  ]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setFeedbackError(null);
  }, [minNumeric]);

  const englishOnlySurfaceLock =
    isEnglishOnlyAuctionsLocked() &&
    auction.auctionType !== "english" &&
    auction.auctionType !== "buy_it_now";

  const supportsAutoBid = auction.auctionType === "english" || auction.auctionType === "buy_it_now";
  const autoBidEligible =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    (lifecycle.kind === "live" ||
      lifecycle.kind === "extended" ||
      (lifecycle.kind === "liveSaleroom" && isLotOnBlock));
  const showAutoBidExplainer =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    !autoBidEligible &&
    (lifecycle.kind === "scheduled" ||
      lifecycle.kind === "preLaunch" ||
      (lifecycle.kind === "liveSaleroom" && !isLotOnBlock));
  const isHybridSale = saleForLifecycle?.deliveryMode === "hybrid";
  const autoBidExplainerText =
    lifecycle.kind === "liveSaleroom" && !isLotOnBlock
      ? "Auto-bid opens when the auctioneer calls this lot on the block."
      : isHybridSale && lifecycle.kind === "scheduled"
        ? `Auto-bid opens when the auctioneer starts the sale${countdownClock ? ` (${countdownClock} until sale start)` : ""}.`
        : `Auto-bid opens when this lot goes live${countdownClock ? ` in ${countdownClock}` : ""}.`;

  const connectionBlocked = biddingLive && !biddingAllowed;

  const activeAutoBidNote =
    includeAutoBidOnManualBid && activeAutoBid?.maxAutoBidAmount
      ? {
          max: activeAutoBid.maxAutoBidAmount,
          onChangeAutoBid: () => switchEntryMode("auto", { userInitiated: true }),
        }
      : null;

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
