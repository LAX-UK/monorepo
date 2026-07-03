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
import { usePlaceBid } from "@/hooks/lot-bid/use-place-bid";
import { useLotBidState } from "@/hooks/use-lot-bid-state";
import { lotBidPositionStickyLabel } from "@/lib/bid/derive-lot-bid-position";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import { useLiveConnection } from "@/lib/connection/use-live-connection";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { formatMoney } from "@/lib/format-currency";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { useEffect, useState } from "react";

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

  const panelState = usePlaceBid({
    auction,
    sessionUser,
    initialAutoBidSettings,
    initialOutbid,
    omitPricingHeader,
    loginNextPath,
    kycSummary,
    saleRegistrationBidGate,
    saleRegistrationPath,
    saleForLifecycle,
    isOwnLot,
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
  });

  const {
    amount,
    setAmount,
    maxAuto,
    setMaxAuto,
    entryMode,
    step,
    setStep,
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
  } = panelState;

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

  const sellerBlocked = isOwnLot;

  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";
  const bidControlsDisabled = (d: { kind: "allow" } | { kind: "block" }) =>
    gateBlocked(d) || connectionBlocked;
  const bidCardInView = onlineLifecycle?.bidCardInView ?? true;
  const showPricingHeader = omitPricingHeader;

  const surface = useBidPanelSurface();

  const [compactExpanded, setCompactExpanded] = useState(false);

  return (
    <BidGate
      user={sessionUser}
      lot={auction}
      lotStatus={lotStatus}
      loginNextPath={loginNext}
      isOwnLot={isOwnLot}
      actingLegalEntityId={actingLegalEntityId}
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
