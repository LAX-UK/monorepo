"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { ConnectionStatusBannerContainer } from "@/components/realtime/connection-status-banner-container";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidForm } from "@/components/sections/artwork/bid-form";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { LotAutoBidPanel } from "@/components/sections/artwork/redesign/lot-auto-bid-panel";
import { LotBidModeChooser } from "@/components/sections/artwork/redesign/lot-bid-mode-chooser";
import { LotBidPositionSummary } from "@/components/sections/artwork/redesign/lot-bid-position-summary";
import { LotInfoStack } from "@/components/sections/artwork/redesign/lot-info-stack";
import { LotPricingStatusHeader } from "@/components/sections/artwork/redesign/lot-pricing-status-header";
import { useLotBidState } from "@/hooks/use-lot-bid-state";
import { type LotBidEntryMode, defaultLotBidEntryMode } from "@/lib/bid/lot-bid-entry-mode";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import { shouldStayOnBidConfirmStep } from "@/lib/ui/bid-error/confirm-step";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  auction: Lot;
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
  saleForLifecycle?: Pick<Sale, "status" | "deliveryMode"> | null;
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
}: Props) {
  const { bidWriter } = useLotPorts();
  const onlineLifecycle = useOnlineLotLifecycle();
  const { biddingAllowed } = useLiveConnection();

  const bidState = useLotBidState({
    auction,
    initialHistory,
    initialLeadingBidderId,
    sessionUser,
    initialAutoBidSettings,
    initialOutbid,
    initialUserHasBid,
    saleForLifecycle,
  });

  const {
    currentPrice,
    startTimeMs,
    endTime,
    lotStatus,
    history,
    activeAutoBid,
    handleAutoBidSaved,
    lifecycle,
    countdownClock,
    timerState,
    remainingLabel,
    saleEndLocalLabel,
    saleStartLocalLabel,
    position,
    biddingLive,
    priceFlash,
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
  const [autoBidStep, setAutoBidStep] = useState(initialAutoBidSettings?.autoBidStepAmount ?? "");
  const [autoBidDraftDirty, setAutoBidDraftDirty] = useState(false);
  const [entryMode, setEntryMode] = useState<LotBidEntryMode>(() =>
    defaultLotBidEntryMode({
      supportsAutoBid: auction.auctionType === "english" || auction.auctionType === "buy_it_now",
      hasActiveAutoBid: Boolean(initialAutoBidSettings?.isActive),
      userPreference: null,
    }),
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<BidErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const confirmIdempotencyKeyRef = useRef<string | null>(null);

  const minNumeric = useMemo(
    () => getMinNextBidAmount(auction, currentPrice),
    [auction, currentPrice],
  );

  const handleAutoBidDraft = useCallback(
    (draft: { maxAuto: string; step: string; dirty: boolean }) => {
      setMaxAuto(draft.maxAuto);
      setAutoBidStep(draft.step);
      setAutoBidDraftDirty(draft.dirty);
    },
    [],
  );

  const onAutoBidSaved = useCallback(
    (settings: AutoBidSettings | null) => {
      handleAutoBidSaved(settings);
      setAutoBidDraftDirty(false);
      if (settings) {
        setMaxAuto(settings.maxAutoBidAmount);
        setAutoBidStep(settings.autoBidStepAmount ?? "");
      } else {
        setMaxAuto("");
        setAutoBidStep("");
      }
    },
    [handleAutoBidSaved],
  );

  useEffect(() => {
    const el = document.getElementById("bid-interactive-anchor");
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

  const includeAutoBidOnManualBid = activeAutoBid?.isActive || autoBidDraftDirty;

  const isWinning = position.kind === "winning" || position.kind === "winningByAuto";

  const supportsAutoBidPanel =
    auction.auctionType === "english" || auction.auctionType === "buy_it_now";

  const focusBidEntry = useCallback(
    (mode: LotBidEntryMode) => {
      setEntryMode(mode);
      requestAnimationFrame(() => {
        if (mode === "auto") scrollToAutoBid();
        else scrollToBid();
      });
    },
    [scrollToAutoBid, scrollToBid],
  );

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (initialOutbid) {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, initialOutbid, supportsAutoBidPanel]);

  useEffect(() => {
    if (!supportsAutoBidPanel) return;
    if (position.kind === "outbid" || position.kind === "inRunning") {
      setEntryMode(activeAutoBid?.isActive ? "auto" : "manual");
    }
  }, [activeAutoBid?.isActive, position.kind, supportsAutoBidPanel]);

  const onReview = useCallback(() => {
    setError(null);
    if (biddingLive && !biddingAllowed) {
      setError(
        clientBidError(
          "Live bidding is unavailable until your connection to the saleroom is restored.",
        ),
      );
      return;
    }
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n + 1e-9 < minNumeric) {
      setError(clientBidError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`));
      return;
    }
    const regLimit = saleRegistrationBidGate?.approvedBidLimit;
    if (regLimit != null && n > regLimit + 1e-9) {
      setError(
        clientBidError(
          `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Enter a lower amount.`,
        ),
      );
      return;
    }
    const maxN =
      includeAutoBidOnManualBid && maxAuto.trim() !== "" ? Number.parseFloat(maxAuto) : undefined;
    if (maxN !== undefined) {
      if (Number.isNaN(maxN) || maxN < n) {
        setError(clientBidError("Max auto-bid must be greater than or equal to your bid."));
        return;
      }
      if (regLimit != null && maxN > regLimit + 1e-9) {
        setError(
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
    includeAutoBidOnManualBid,
    maxAuto,
    minNumeric,
    saleRegistrationBidGate?.approvedBidLimit,
    biddingAllowed,
    biddingLive,
  ]);

  const onConfirm = useCallback(async () => {
    setError(null);
    if (biddingLive && !biddingAllowed) {
      setError(
        clientBidError(
          "Live bidding is unavailable until your connection to the saleroom is restored.",
        ),
      );
      return;
    }
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setError(clientBidError("Invalid amount"));
      return;
    }
    const maxN =
      includeAutoBidOnManualBid && maxAuto.trim() !== "" ? Number.parseFloat(maxAuto) : undefined;
    const stepN =
      includeAutoBidOnManualBid && autoBidStep.trim() !== ""
        ? Number.parseFloat(autoBidStep)
        : undefined;
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
      setError(clientBidError("Could not reach the server. Check your connection and try again."));
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
      setError(mapped);
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
      setAutoBidStep("");
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
    autoBidStep,
    bidWriter,
    clearConfirmAttempt,
    ensureConfirmIdempotencyKey,
    includeAutoBidOnManualBid,
    kycSummary?.feedback,
    loginNext,
    markLotEndedLocally,
    maxAuto,
    saleRegistrationPath,
    setActiveAutoBid,
    biddingAllowed,
    biddingLive,
  ]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setError(null);
  }, [minNumeric]);

  const englishOnlySurfaceLock =
    isEnglishOnlyAuctionsLocked() &&
    auction.auctionType !== "english" &&
    auction.auctionType !== "buy_it_now";

  const supportsAutoBid = auction.auctionType === "english" || auction.auctionType === "buy_it_now";
  const autoBidEligible =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    (lifecycle.kind === "live" || lifecycle.kind === "extended");
  const showAutoBidExplainer =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    !autoBidEligible &&
    (lifecycle.kind === "scheduled" || lifecycle.kind === "preLaunch");

  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";
  const connectionBlocked = biddingLive && !biddingAllowed;
  const bidControlsDisabled = (d: { kind: "allow" } | { kind: "block" }) =>
    gateBlocked(d) || connectionBlocked;
  const bidCardInView = onlineLifecycle?.bidCardInView ?? true;
  const showPricingHeader = omitPricingHeader;

  const activeAutoBidNote =
    includeAutoBidOnManualBid && maxAuto.trim() !== ""
      ? { max: maxAuto, onChangeAutoBid: scrollToAutoBid }
      : null;

  return (
    <BidGate
      user={sessionUser}
      lot={auction}
      lotStatus={lotStatus}
      loginNextPath={loginNext}
      kycBidGate={
        kycSummary?.requiresKyc
          ? { requiresKyc: true, feedback: kycSummary.feedback ?? null }
          : null
      }
      saleRegistrationBidGate={saleRegistrationBidGate}
      biddingLifecycle={{ kind: lifecycle.kind }}
      orgModuleEnabled={orgModuleEnabled}
    >
      {({ decision }) => (
        <div className={cn("min-w-0", omitPricingHeader ? "w-full max-w-none" : "max-w-[480px]")}>
          {biddingLive ? <ConnectionStatusBannerContainer className="mb-4" /> : null}
          <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
            {showPricingHeader ? (
              <LotPricingStatusHeader
                seed={summarySeed}
                currentPrice={currentPrice}
                minNextBid={minNumeric.toFixed(2)}
                lotNumber={auction.lotNumber}
                reservePrice={auction.reservePrice}
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
                reservePrice={auction.reservePrice}
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
              />
            ) : null}

            <div className="mt-6 space-y-3">
              {extendedByMs != null && extendedByMs > 0 ? (
                <p
                  className="inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-amber-900 dark:text-amber-200"
                  aria-live="polite"
                >
                  Extended +{Math.max(1, Math.round(extendedByMs / 1000))}s
                </p>
              ) : null}
              <LotBidPositionSummary
                position={position}
                loginNextPath={loginNext}
                onIncreaseBid={() => focusBidEntry("manual")}
                {...(supportsAutoBid ? { onRaiseAutoBid: () => focusBidEntry("auto") } : {})}
              />
            </div>

            {englishOnlySurfaceLock ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                Self-service bidding is only offered for English and buy-now lots while this
                catalogue mode is enabled. For this listing, please contact the saleroom team.
              </p>
            ) : null}

            {autoBidEligible && supportsAutoBid ? (
              <div className="mt-6">
                <LotBidModeChooser
                  mode={entryMode}
                  onModeChange={setEntryMode}
                  disabled={bidControlsDisabled(decision)}
                />
              </div>
            ) : null}

            {autoBidEligible && entryMode === "auto" ? (
              <div id="lot-auto-bid-panel" className="mt-4 scroll-mt-28">
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
                />
              </div>
            ) : showAutoBidExplainer ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                Auto-bid opens when this lot goes live
                {countdownClock ? ` in ${countdownClock}` : ""}.
              </p>
            ) : null}

            {!englishOnlySurfaceLock && (autoBidEligible ? entryMode === "manual" : true) ? (
              <>
                <div
                  id="bid-interactive-anchor"
                  tabIndex={-1}
                  className={cn(
                    "scroll-mt-28 outline-none focus:outline-none",
                    autoBidEligible ? "mt-4" : "mt-6",
                  )}
                >
                  {bidSuccess ? (
                    <output className="mb-4 block rounded-md bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container ring-1 ring-primary/30">
                      Bid placed successfully.
                    </output>
                  ) : null}

                  {decision.kind === "block" ? (
                    decision.render()
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
                      error={error}
                      showMaxAutoField={false}
                      reviewButtonClassName={FIGMA_PRIMARY}
                      amountFieldVariant={useOnlineBidStepper ? "stepper" : "input"}
                      stepNumeric={bidStepNumeric}
                      step1ButtonLabel="Review bid"
                      activeAutoBidNote={activeAutoBidNote}
                      biddingDisabled={connectionBlocked}
                    />
                  ) : (
                    <BidConfirmation
                      amount={amount}
                      maxAuto={includeAutoBidOnManualBid && maxAuto.trim() !== "" ? maxAuto : null}
                      autoBidStep={
                        includeAutoBidOnManualBid && autoBidStep.trim() !== "" ? autoBidStep : null
                      }
                      error={error}
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

                <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
                  Minimum next bid{" "}
                  <span className="font-medium text-on-surface">
                    {formatMoney(minNumeric.toFixed(2))}
                  </span>
                  {biddingLive ? (
                    <>
                      {" "}
                      · {saleEndLocalLabel}. Timer uses your device&apos;s local time. Hammer price
                      plus buyer&apos;s premium; see{" "}
                      <a href="/shipping" className="text-link underline">
                        shipping
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              </>
            ) : null}
          </div>

          {!englishOnlySurfaceLock ? (
            <BidStickyMobileBar
              live={biddingLive}
              decision={decision}
              loginNextPath={loginNext}
              kycFeedback={kycSummary?.feedback ?? null}
              {...(saleRegistrationPath ? { saleRegistrationPath } : {})}
              step={step}
              currentPriceLabel={formatMoney(currentPrice)}
              priceFlash={priceFlash}
              onScrollToBid={scrollToBid}
              remainingLabel={remainingLabel}
              msRemaining={msRemaining}
              timerState={timerState}
              countdownClock={countdownClock}
              compact={bidCardInView}
              position={position}
              hasActiveAutoBid={Boolean(activeAutoBid?.isActive)}
              onFocusManualBid={() => focusBidEntry("manual")}
              onFocusAutoBid={() => focusBidEntry("auto")}
            />
          ) : null}
        </div>
      )}
    </BidGate>
  );
}
