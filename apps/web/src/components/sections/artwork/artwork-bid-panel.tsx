"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { LotBidFeedbackBanner } from "@/components/bid/lot-bid-feedback-banner";
import { ConnectionStatusBannerContainer } from "@/components/realtime/connection-status-banner-container";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidForm } from "@/components/sections/artwork/bid-form";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useBidPanelSurface } from "@/components/sections/artwork/online/bid-panel-surface";
import { ApprovedBidLimitNotice } from "@/components/sections/artwork/redesign/approved-bid-limit-notice";
import { LotAutoBidPanel } from "@/components/sections/artwork/redesign/lot-auto-bid-panel";
import { LotBidModeChooser } from "@/components/sections/artwork/redesign/lot-bid-mode-chooser";
import { LotBidPositionSummary } from "@/components/sections/artwork/redesign/lot-bid-position-summary";
import { LotInfoStack } from "@/components/sections/artwork/redesign/lot-info-stack";
import { LotPricingStatusHeader } from "@/components/sections/artwork/redesign/lot-pricing-status-header";
import { ParticipationWarningBadge } from "@/components/ui/participation-warning-badge";
import { useLotBidState } from "@/hooks/use-lot-bid-state";
import { sendVerificationEmailForReturnPath } from "@/lib/auth/services/send-verification-email.service";
import { lotBidPositionStickyLabel } from "@/lib/bid/derive-lot-bid-position";
import { evaluateManualBidEligibility } from "@/lib/bid/evaluate-lot-bid-eligibility";
import { type LotBidEntryMode, defaultLotBidEntryMode } from "@/lib/bid/lot-bid-entry-mode";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { AutoBidPlacedBid, AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import { BID_ERROR_CODES } from "@/lib/ui/bid-error/codes";
import { shouldStayOnBidConfirmStep } from "@/lib/ui/bid-error/confirm-step";
import { notify } from "@/lib/ui/notify";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  auction: Lot | PublicLotView;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  summarySeed: LotSummarySeedVM;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  initialUserHasBid?: boolean;
  initialWatching?: boolean;
  loginNextPath?: string;
  omitPricingHeader?: boolean;
  kycSummary?: KycStatusSummaryDto | null;
  saleRegistrationBidGate?: SaleRegistrationBidGateContext | null;
  saleRegistrationPath?: string | null;
  orgModuleEnabled?: boolean;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
  isOwnLot?: boolean;
  actingLegalEntityId?: string | null;
  strictBidEligibilityEnabled?: boolean;
};

const FIGMA_PRIMARY =
  "rounded border border-outline bg-on-surface px-8 py-4 text-base font-semibold leading-6 tracking-wide text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-highest";

export function ArtworkBidPanel({
  auction,
  initialHistory,
  initialLeadingBidderId = null,
  sessionUser,
  summarySeed,
  initialAutoBidSettings = null,
  initialOutbid = false,
  initialUserHasBid = false,
  initialWatching = false,
  loginNextPath,
  omitPricingHeader = false,
  kycSummary = null,
  saleRegistrationBidGate = null,
  saleRegistrationPath = null,
  orgModuleEnabled = true,
  saleForLifecycle = null,
  isOwnLot = false,
  actingLegalEntityId = null,
  strictBidEligibilityEnabled = false,
}: Props) {
  const { bidWriter } = useLotPorts();
  const { refreshFromServer } = useLotBidHistory();
  const onlineLifecycle = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const connectivityScope = saleroomLive ? "hybrid" : "bidding";
  const { biddingAllowed, realtimeHealthy } = useLiveConnection();
  const isLotOnBlock = saleroomLive?.isLotOnBlock(auction.id) ?? false;

  const bidState = useLotBidState({
    auction,
    initialHistory,
    initialLeadingBidderId,
    sessionUser,
    initialAutoBidSettings,
    initialOutbid,
    initialUserHasBid,
    saleForLifecycle,
    isOwnLot,
  });

  const {
    currentPrice,
    startTimeMs,
    endTime,
    lotStatus,
    history,
    leadingBidderId,
    activeAutoBid,
    handleAutoBidSaved,
    lifecycle,
    countdownClock,
    timerState,
    remainingLabel,
    saleEndLocalLabel,
    saleStartLocalLabel,
    position,
    reserveContext,
    biddingLive,
    priceFlash,
    noSaleReason,
    applyOwnBidResult,
    scrollToBid,
    scrollToAutoBid,
    extendedByMs,
    msRemaining,
    markLotEndedLocally,
    setActiveAutoBid,
  } = bidState;

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
    const el = document.getElementById("lot-bid-entry");
    if (!el || !onlineLifecycle || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onlineLifecycle.setBidCardInView(entry?.isIntersecting ?? false);
      },
      { root: null, rootMargin: "0px 0px -80px 0px", threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onlineLifecycle]);

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
      } else if (actionKey === "resend-verification-email" && sessionUser?.email) {
        void sendVerificationEmailForReturnPath({
          email: sessionUser.email,
          next: loginNext,
        }).then((result) => {
          if (result.ok) notify.success("Verification email sent");
          else notify.error(result.message);
        });
      }
    },
    [loginNext, sessionUser?.email, switchEntryMode],
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

  const sellerBlocked = isOwnLot;

  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";
  const connectionBlocked = biddingLive && !biddingAllowed;
  const bidControlsDisabled = (d: { kind: "allow" } | { kind: "block" }) =>
    gateBlocked(d) || connectionBlocked;
  const bidCardInView = onlineLifecycle?.bidCardInView ?? true;
  const showPricingHeader = omitPricingHeader;

  const surface = useBidPanelSurface();

  const activeAutoBidNote =
    includeAutoBidOnManualBid && activeAutoBid?.maxAutoBidAmount
      ? {
          max: activeAutoBid.maxAutoBidAmount,
          onChangeAutoBid: () => switchEntryMode("auto", { userInitiated: true }),
        }
      : null;

  const [compactExpanded, setCompactExpanded] = useState(false);

  return (
    <BidGate
      user={sessionUser}
      lot={auction}
      lotStatus={lotStatus}
      loginNextPath={loginNext}
      isOwnLot={isOwnLot}
      actingLegalEntityId={actingLegalEntityId}
      strictBidEligibilityEnabled={strictBidEligibilityEnabled}
      kycBidGate={
        kycSummary?.requiresKyc
          ? { requiresKyc: true, feedback: kycSummary.feedback ?? null }
          : null
      }
      saleRegistrationBidGate={saleRegistrationBidGate}
      biddingLifecycle={{ kind: lifecycle.kind, isOnBlock: isLotOnBlock }}
      orgModuleEnabled={orgModuleEnabled}
    >
      {({ decision }) => {
        /**
         * Shared interactive region — the bid entry form / confirm step + auto-bid.
         * Rendered identically on both the full card and the compact bar (when expanded).
         * All variables are from the outer component scope; no state duplication.
         */
        const bidEntryRegion = (
          <div
            id={surface === "full" ? "lot-bid-entry" : undefined}
            tabIndex={surface === "full" ? -1 : undefined}
            className={
              surface === "full" ? "scroll-mt-28 outline-none focus:outline-none" : undefined
            }
          >
            <LotBidFeedbackBanner
              error={displayedFeedback}
              className="mt-6"
              onAction={handleFeedbackAction}
            />

            {decision.kind === "block" && !sellerBlocked ? decision.render() : null}

            {!englishOnlySurfaceLock && !sellerBlocked && autoBidEligible && supportsAutoBid ? (
              <div className="mt-6">
                <LotBidModeChooser
                  mode={entryMode}
                  onModeChange={(mode) => switchEntryMode(mode, { userInitiated: true })}
                  disabled={bidControlsDisabled(decision)}
                />
              </div>
            ) : null}

            {!englishOnlySurfaceLock && !sellerBlocked && autoBidEligible ? (
              <div
                id={surface === "full" ? "lot-auto-bid-panel" : undefined}
                className={cn("mt-4 scroll-mt-28", entryMode !== "auto" && "hidden")}
                aria-hidden={entryMode !== "auto"}
              >
                <LotAutoBidPanel
                  lot={auction}
                  auctionType={auction.auctionType}
                  currentPrice={currentPrice}
                  minNextBid={minNumeric}
                  isWinning={isWinning}
                  disabled={bidControlsDisabled(decision)}
                  loginNextPath={loginNext}
                  initialSettings={activeAutoBid}
                  approvedBidLimit={saleRegistrationBidGate?.approvedBidLimit ?? null}
                  onDraftChange={handleAutoBidDraft}
                  onSettingsSaved={onAutoBidSaved}
                  onFeedbackError={setFeedbackError}
                  kycFeedback={kycSummary?.feedback ?? null}
                  biddingLive={biddingLive}
                  biddingAllowed={biddingAllowed}
                  realtimeHealthy={realtimeHealthy}
                  refreshBeforeSave={async () => (await refreshFromServer()).ok}
                />
              </div>
            ) : !englishOnlySurfaceLock && showAutoBidExplainer ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                {autoBidExplainerText}
              </p>
            ) : null}

            {!englishOnlySurfaceLock &&
            (sellerBlocked
              ? decision.kind === "block"
              : autoBidEligible
                ? entryMode === "manual"
                : true) ? (
              <>
                <div
                  id={surface === "full" ? "bid-interactive-anchor" : undefined}
                  className={cn(autoBidEligible && !sellerBlocked ? "mt-4" : "mt-6")}
                >
                  {bidSuccess ? (
                    <output className="mb-4 block rounded-md bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container ring-1 ring-primary/30">
                      Bid placed successfully.
                    </output>
                  ) : null}

                  {decision.kind === "block" ? (
                    sellerBlocked ? (
                      decision.render()
                    ) : null
                  ) : step === 1 ? (
                    <BidForm
                      auctionType={auction.auctionType}
                      minNumeric={minNumeric}
                      amount={amount}
                      maxAuto={maxAuto}
                      onAmountChange={setAmount}
                      onMaxAutoChange={setMaxAuto}
                      onReview={onReview}
                      onUseMinimum={onUseMinimum}
                      error={null}
                      manualBidBlockedReason={manualBidBlockedReason}
                      showMaxAutoField={false}
                      reviewButtonClassName={FIGMA_PRIMARY}
                      amountFieldVariant={useOnlineBidStepper ? "stepper" : "input"}
                      stepNumeric={bidStepNumeric}
                      step1ButtonLabel="Review bid"
                      activeAutoBidNote={activeAutoBidNote}
                      biddingDisabled={connectionBlocked || Boolean(manualBidBlockedReason)}
                    />
                  ) : (
                    <BidConfirmation
                      amount={amount}
                      maxAuto={
                        includeAutoBidOnManualBid && activeAutoBid?.maxAutoBidAmount
                          ? activeAutoBid.maxAutoBidAmount
                          : null
                      }
                      autoBidStep={
                        includeAutoBidOnManualBid && activeAutoBid?.autoBidStepAmount
                          ? activeAutoBid.autoBidStepAmount
                          : null
                      }
                      error={null}
                      submitting={submitting}
                      biddingDisabled={connectionBlocked}
                      onCancel={() => {
                        clearConfirmAttempt();
                        setStep(1);
                      }}
                      onConfirm={onConfirm}
                    />
                  )}
                </div>

                {!sellerBlocked ? (
                  <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
                    Minimum next bid{" "}
                    <span className="font-medium text-on-surface">
                      {formatMoney(minNumeric.toFixed(2))}
                    </span>
                    {biddingLive &&
                    lifecycle.kind !== "liveSaleroom" &&
                    lifecycle.kind !== "saleroomPaused" ? (
                      <>
                        {" "}
                        · {saleEndLocalLabel}. Timer uses your device&apos;s local time. Hammer
                        price plus buyer&apos;s premium; see{" "}
                        <a href="/shipping" className="text-link underline">
                          shipping
                        </a>
                        .
                      </>
                    ) : null}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        );

        /* ── Video compact surface ─────────────────────────────────────────────
         * Shown when the user is on the Video Stream tab.
         * The compact bar (price + position + Bid button) sits under the video;
         * pressing Bid expands inline to reveal the real bid form via bidEntryRegion.
         * BidStickyMobileBar is suppressed here (the bar itself replaces it).
         */
        if (surface === "videoCompact") {
          const positionLabel = lotBidPositionStickyLabel(position, reserveContext);
          const canBid = decision.kind !== "block" && !connectionBlocked && !englishOnlySurfaceLock;

          return (
            <div className="min-w-0">
              {biddingLive ? (
                <ConnectionStatusBannerContainer scope={connectivityScope} className="mb-3" />
              ) : null}
              <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
                {/* Compact summary row */}
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
                      Current bid
                    </p>
                    <p
                      className={`font-headline text-xl tabular-nums text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
                    >
                      {formatMoney(currentPrice)}
                    </p>
                    <p className="mt-0.5 font-label text-[0.65rem] text-secondary">
                      Min next {formatMoney(minNumeric.toFixed(2))}
                      {positionLabel ? (
                        <span className="ml-2 font-bold uppercase tracking-wider text-primary">
                          · {positionLabel}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {!compactExpanded ? (
                    <Button
                      type="button"
                      aria-expanded={false}
                      disabled={!canBid && decision.kind === "allow"}
                      onClick={() => {
                        if (decision.kind === "block") {
                          setCompactExpanded(true);
                        } else if (canBid) {
                          switchEntryMode("manual", { userInitiated: true });
                          setCompactExpanded(true);
                        }
                      }}
                      className="shrink-0 rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm hover:bg-cta-bg/90"
                    >
                      {step === 2 ? "Confirm bid" : "Bid"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      aria-expanded={true}
                      variant="ghost"
                      onClick={() => setCompactExpanded(false)}
                      className="shrink-0 px-3 py-2 font-label text-xs text-on-surface-variant"
                    >
                      Close
                    </Button>
                  )}
                </div>

                {/* Inline-expanded bid flow — same bidEntryRegion used by the full card */}
                {compactExpanded ? (
                  <div className="mt-4 border-t border-outline-variant/20 pt-4">
                    {bidEntryRegion}
                  </div>
                ) : null}
              </div>
              {/* BidStickyMobileBar is intentionally NOT rendered in videoCompact —
                  the compact bar above serves as the always-visible bid affordance. */}
            </div>
          );
        }

        /* ── Full surface (Bids View tab / no video stream) ────────────────── */
        return (
          <div className={cn("min-w-0", omitPricingHeader ? "w-full max-w-none" : "max-w-[480px]")}>
            {biddingLive ? (
              <ConnectionStatusBannerContainer scope={connectivityScope} className="mb-4" />
            ) : null}
            <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
              {showPricingHeader ? (
                <LotPricingStatusHeader
                  seed={summarySeed}
                  currentPrice={currentPrice}
                  minNextBid={minNumeric.toFixed(2)}
                  lotNumber={auction.lotNumber}
                  reserveContext={reserveContext}
                  lifecycle={lifecycle}
                  countdownClock={countdownClock}
                  extendedByMs={extendedByMs}
                />
              ) : null}
              {!omitPricingHeader ? (
                <LotInfoStack
                  estimateLine={summarySeed.estimateLine}
                  currentPrice={currentPrice}
                  bidCount={history.length}
                  reserveContext={reserveContext}
                  lifecycle={lifecycle}
                  countdownClock={countdownClock}
                  saleEndLocalLabel={saleEndLocalLabel}
                  saleStartLocalLabel={saleStartLocalLabel}
                  endAtIso={new Date(endTime).toISOString()}
                  startAtIso={new Date(startTimeMs).toISOString()}
                  currentUserId={sessionUser?.id ?? null}
                  scheduledNotifySlot={
                    lifecycle.kind === "scheduled" ? (
                      <ArtworkWatchToggle
                        lotId={auction.id}
                        initialWatching={initialWatching}
                        isAuthenticated={Boolean(sessionUser)}
                        loginNextPath={loginNext}
                        marketingCta="notifyWhenOpens"
                      />
                    ) : null
                  }
                  endedNoSaleNotifySlot={
                    lifecycle.kind === "endedNoSale" ? (
                      <ArtworkWatchToggle
                        lotId={auction.id}
                        initialWatching={initialWatching}
                        isAuthenticated={Boolean(sessionUser)}
                        loginNextPath={loginNext}
                        marketingCta="notifyIfRelisted"
                      />
                    ) : null
                  }
                  noSaleReason={noSaleReason ?? undefined}
                />
              ) : null}

              <div className="mt-6 space-y-3">
                {extendedByMs != null && extendedByMs > 0 ? (
                  <ParticipationWarningBadge
                    kind="antiSnipeExtended"
                    extendedSeconds={Math.round(extendedByMs / 1000)}
                    className="normal-case"
                  />
                ) : null}
                <LotBidPositionSummary
                  position={position}
                  loginNextPath={loginNext}
                  {...(decision.kind !== "block"
                    ? {
                        onIncreaseBid: () => switchEntryMode("manual", { userInitiated: true }),
                        ...(supportsAutoBid
                          ? {
                              onRaiseAutoBid: () =>
                                switchEntryMode("auto", { userInitiated: true }),
                            }
                          : {}),
                        supportsAutoBid,
                      }
                    : {})}
                />
                {saleRegistrationBidGate?.approvedBidLimit != null ? (
                  <ApprovedBidLimitNotice
                    approvedBidLimit={saleRegistrationBidGate.approvedBidLimit}
                    currentPrice={currentPrice}
                  />
                ) : null}
              </div>

              {englishOnlySurfaceLock ? (
                <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                  Self-service bidding is only offered for English and buy-now lots while this
                  catalogue mode is enabled. For this listing, please contact the saleroom team.
                </p>
              ) : null}

              {bidEntryRegion}
            </div>

            {!englishOnlySurfaceLock ? (
              <BidStickyMobileBar
                live={biddingLive}
                decision={decision}
                loginNextPath={loginNext}
                lotId={auction.id}
                userEmail={sessionUser?.email ?? null}
                kycFeedback={kycSummary?.feedback ?? null}
                {...(saleRegistrationPath ? { saleRegistrationPath } : {})}
                step={step}
                currentPriceLabel={formatMoney(currentPrice)}
                priceFlash={priceFlash}
                onScrollToBid={() => switchEntryMode("manual", { userInitiated: true })}
                remainingLabel={remainingLabel}
                msRemaining={msRemaining}
                timerState={timerState}
                countdownClock={countdownClock}
                lifecycleKind={lifecycle.kind}
                isOnBlock={isLotOnBlock}
                compact={bidCardInView}
                position={position}
                reserveContext={reserveContext}
                hasActiveAutoBid={Boolean(activeAutoBid?.isActive)}
                onFocusManualBid={() => switchEntryMode("manual", { userInitiated: true })}
                onFocusAutoBid={() => switchEntryMode("auto", { userInitiated: true })}
                isLeading={
                  position.kind === "winning" ||
                  position.kind === "winningByAuto" ||
                  position.kind === "leadingBelowReserve"
                }
                upcomingSlot={
                  <ArtworkWatchToggle
                    lotId={auction.id}
                    initialWatching={initialWatching}
                    isAuthenticated={Boolean(sessionUser)}
                    loginNextPath={loginNext}
                    appearance="sticky-bar"
                    marketingCta="notifyWhenOpens"
                  />
                }
              />
            ) : null}
          </div>
        );
      }}
    </BidGate>
  );
}
