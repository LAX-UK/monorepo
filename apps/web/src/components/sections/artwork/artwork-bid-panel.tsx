"use client";

import { BidGate } from "@/components/bid/bid-gate";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import {
  BidPanelProvider,
  type BidPanelStickyVM,
} from "@/components/sections/artwork/online/bid-panel-context";
import { useBidPanelSurface } from "@/components/sections/artwork/online/bid-panel-surface";
import { FullBidCard } from "@/components/sections/artwork/online/full-bid-card";
import { VideoCompactBidPanel } from "@/components/sections/artwork/online/video-compact-bid-panel";
import { usePlaceBid } from "@/hooks/lot-bid/use-place-bid";
import { useLotBidState } from "@/hooks/use-lot-bid-state";
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
import { useEffect } from "react";

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
  const {
    biddingAllowed,
    realtimeHealthy,
    state: connectionState,
    message: connectionMessage,
  } = useLiveConnection();
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

  const panel = usePlaceBid({
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

  const { step, loginNext, switchEntryMode, connectionBlocked } = panel;

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
  const surface = useBidPanelSurface();

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
      strictBidEligibilityEnabled={strictBidEligibilityEnabled}
      biddingLifecycle={{ kind: lifecycle.kind, isOnBlock: isLotOnBlock }}
      orgModuleEnabled={orgModuleEnabled}
      unsupportedAuctionMode={panel.englishOnlySurfaceLock}
      connectionBlocked={panel.connectionBlocked}
      connectionState={connectionState}
      connectionMessage={connectionMessage}
    >
      {({ decision }) => {
        const sticky: BidPanelStickyVM = {
          live: biddingLive,
          loginNextPath: loginNext,
          lotId: auction.id,
          userEmail: sessionUser?.email ?? null,
          kycFeedback: kycSummary?.feedback ?? null,
          ...(saleRegistrationPath ? { saleRegistrationPath } : {}),
          step,
          currentPriceLabel: formatMoney(currentPrice),
          priceFlash,
          onScrollToBid: () => switchEntryMode("manual", { userInitiated: true }),
          remainingLabel,
          msRemaining,
          timerState,
          countdownClock,
          lifecycleKind: lifecycle.kind,
          isOnBlock: isLotOnBlock,
          compact: bidCardInView,
          position,
          reserveContext,
          hasActiveAutoBid: Boolean(activeAutoBid?.isActive),
          onFocusManualBid: () => switchEntryMode("manual", { userInitiated: true }),
          onFocusAutoBid: () => switchEntryMode("auto", { userInitiated: true }),
          isLeading:
            position.kind === "winning" ||
            position.kind === "winningByAuto" ||
            position.kind === "leadingBelowReserve",
          upcomingSlot: (
            <ArtworkWatchToggle
              lotId={auction.id}
              initialWatching={initialWatching}
              isAuthenticated={Boolean(sessionUser)}
              loginNextPath={loginNext}
              appearance="sticky-bar"
              marketingCta="notifyWhenOpens"
            />
          ),
        };

        return (
          <BidPanelProvider
            value={{
              surface,
              decision,
              gateBlocked,
              bidControlsDisabled,
              sellerBlocked,
              connectivityScope,
              auction,
              sessionUser,
              summarySeed,
              initialWatching,
              omitPricingHeader,
              showPricingHeader: omitPricingHeader,
              kycSummary,
              saleRegistrationBidGate,
              currentPrice,
              history,
              leadingBidderId,
              activeAutoBid,
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
              extendedByMs: extendedByMs ?? null,
              msRemaining,
              startTimeMs,
              endTime,
              refreshFromServer,
              biddingAllowed,
              realtimeHealthy,
              isLotOnBlock,
              panel,
              sticky,
            }}
          >
            {surface === "videoCompact" ? <VideoCompactBidPanel /> : <FullBidCard />}
          </BidPanelProvider>
        );
      }}
    </BidGate>
  );
}
