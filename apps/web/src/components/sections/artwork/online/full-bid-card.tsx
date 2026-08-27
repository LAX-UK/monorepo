"use client";

import { ConnectionStatusBannerContainer } from "@/components/realtime/connection-status-banner-container";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { BidEntryRegion } from "@/components/sections/artwork/online/bid-entry-region";
import { useBidPanelContext } from "@/components/sections/artwork/online/bid-panel-context";
import { BidPanelStickyMobileBar } from "@/components/sections/artwork/online/bid-panel-sticky-mobile-bar";
import { ApprovedBidLimitNotice } from "@/components/sections/artwork/redesign/approved-bid-limit-notice";
import { LotBidPositionSummary } from "@/components/sections/artwork/redesign/lot-bid-position-summary";
import { LotInfoStack } from "@/components/sections/artwork/redesign/lot-info-stack";
import { LotPricingStatusHeader } from "@/components/sections/artwork/redesign/lot-pricing-status-header";
import { ParticipationWarningBadge } from "@/components/ui/participation-warning-badge";
import { isHardBidBlocker } from "@/lib/bid/bid-blocker-presentation";
import { cn } from "@auction/ui";

export function FullBidCard() {
  const {
    connectivityScope,
    biddingLive,
    omitPricingHeader,
    summarySeed,
    auction,
    currentPrice,
    history,
    reserveContext,
    lifecycle,
    countdownClock,
    extendedByMs,
    sessionUser,
    initialWatching,
    saleEndLocalLabel,
    saleStartLocalLabel,
    startTimeMs,
    endTime,
    noSaleReason,
    saleRegistrationBidGate,
    decision,
    position,
    panel,
  } = useBidPanelContext();

  const { minNumeric, loginNext, englishOnlySurfaceLock, supportsAutoBid, switchEntryMode } = panel;

  return (
    <div className={cn("min-w-0", omitPricingHeader ? "w-full max-w-none" : "max-w-[480px]")}>
      {biddingLive ? (
        <ConnectionStatusBannerContainer scope={connectivityScope} className="mb-4" />
      ) : null}
      <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
        {omitPricingHeader ? (
          <LotPricingStatusHeader
            seed={summarySeed}
            currentPrice={currentPrice}
            minNextBid={minNumeric.toFixed(2)}
            lotNumber={auction.lotNumber}
            reserveContext={reserveContext}
            lifecycle={lifecycle}
            countdownClock={countdownClock}
            extendedByMs={extendedByMs ?? null}
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
          {decision.kind === "block" && isHardBidBlocker(decision.presentation) ? null : (
            <LotBidPositionSummary
              position={position}
              loginNextPath={loginNext}
              {...(decision.kind !== "block"
                ? {
                    onIncreaseBid: () => switchEntryMode("manual", { userInitiated: true }),
                    ...(supportsAutoBid
                      ? {
                          onRaiseAutoBid: () => switchEntryMode("auto", { userInitiated: true }),
                        }
                      : {}),
                    supportsAutoBid,
                  }
                : {})}
            />
          )}
          {saleRegistrationBidGate?.approvedBidLimit != null ? (
            <ApprovedBidLimitNotice
              approvedBidLimit={saleRegistrationBidGate.approvedBidLimit}
              currentPrice={currentPrice}
            />
          ) : null}
        </div>

        <BidEntryRegion />
      </div>

      {!englishOnlySurfaceLock ? <BidPanelStickyMobileBar /> : null}
    </div>
  );
}
