"use client";

import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotBidEligibility } from "@/hooks/lot-bid/use-lot-bid-eligibility";
import { useLotCountdown } from "@/hooks/lot-bid/use-lot-countdown";
import { useLotRealtimePricing } from "@/hooks/lot-bid/use-lot-realtime-pricing";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { useCallback } from "react";

export type UseLotBidStateParams = {
  auction: Lot | PublicLotView;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  initialUserHasBid?: boolean;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
  isOwnLot?: boolean;
};

export type UseLotBidStateResult = {
  currentPrice: string;
  endTime: number;
  startTimeMs: number;
  lotStatus: Lot["status"];
  leadingBidderId: string | null;
  history: BidHistoryEntry[];
  activeAutoBid: AutoBidSettings | null;
  setActiveAutoBid: (settings: AutoBidSettings | null) => void;
  handleAutoBidSaved: (settings: AutoBidSettings | null) => void;
  lifecycle: ReturnType<typeof useLotCountdown>["lifecycle"];
  countdownClock: string;
  timerState: ReturnType<typeof useLotCountdown>["timerState"];
  remainingLabel: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
  position: ReturnType<typeof useLotBidEligibility>["position"];
  reserveContext: ReturnType<typeof useLotRealtimePricing>["reserveContext"];
  biddingLive: boolean;
  priceFlash: boolean;
  endedBanner: string | null;
  noSaleReason: ReturnType<typeof useLotRealtimePricing>["noSaleReason"];
  outbidSignal: boolean;
  userHasBid: boolean;
  applyOwnBidResult: ReturnType<typeof useLotRealtimePricing>["applyOwnBidResult"];
  scrollToBid: () => void;
  scrollToAutoBid: () => void;
  extendedByMs: number | null;
  msRemaining: number;
  markLotEndedLocally: (banner: string) => void;
};

export function useLotBidState({
  auction,
  sessionUser,
  initialAutoBidSettings = null,
  initialOutbid = false,
  initialUserHasBid = false,
  saleForLifecycle = null,
  isOwnLot = false,
}: UseLotBidStateParams): UseLotBidStateResult {
  const pricing = useLotRealtimePricing({
    auction,
    sessionUser,
    initialAutoBidSettings,
    initialOutbid,
    initialUserHasBid,
  });

  const countdown = useLotCountdown({
    auction,
    endTime: pricing.endTime,
    startTimeMs: pricing.startTimeMs,
    lotStatus: pricing.lotStatus,
    currentPrice: pricing.currentPrice,
    leadingBidderId: pricing.leadingBidderId,
    saleForLifecycle,
  });

  const eligibility = useLotBidEligibility({
    auction,
    sessionUser,
    lotStatus: pricing.lotStatus,
    lifecycle: countdown.lifecycle,
    leadingBidderId: pricing.leadingBidderId,
    userHasBid: pricing.userHasBid,
    outbidSignal: pricing.outbidSignal,
    activeAutoBid: pricing.activeAutoBid,
    endedBanner: pricing.endedBanner,
    reserveContext: pricing.reserveContext,
    noSaleReason: pricing.noSaleReason,
    isOwnLot,
  });

  const scrollToBid = useCallback(() => {
    document.getElementById("lot-bid-entry")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToAutoBid = useCallback(() => {
    document.getElementById("lot-auto-bid-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  return {
    currentPrice: pricing.currentPrice,
    endTime: pricing.endTime,
    startTimeMs: pricing.startTimeMs,
    lotStatus: pricing.lotStatus,
    leadingBidderId: pricing.leadingBidderId,
    history: pricing.history,
    activeAutoBid: pricing.activeAutoBid,
    setActiveAutoBid: pricing.setActiveAutoBid,
    handleAutoBidSaved: pricing.handleAutoBidSaved,
    lifecycle: countdown.lifecycle,
    countdownClock: countdown.countdownClock,
    timerState: countdown.timerState,
    remainingLabel: countdown.remainingLabel,
    saleEndLocalLabel: countdown.saleEndLocalLabel,
    saleStartLocalLabel: countdown.saleStartLocalLabel,
    position: eligibility.position,
    reserveContext: pricing.reserveContext,
    biddingLive: countdown.biddingLive,
    priceFlash: pricing.priceFlash,
    endedBanner: pricing.endedBanner,
    noSaleReason: pricing.noSaleReason,
    outbidSignal: pricing.outbidSignal,
    userHasBid: pricing.userHasBid,
    applyOwnBidResult: pricing.applyOwnBidResult,
    scrollToBid,
    scrollToAutoBid,
    extendedByMs: countdown.extendedByMs,
    msRemaining: countdown.msRemaining,
    markLotEndedLocally: pricing.markLotEndedLocally,
  };
}
