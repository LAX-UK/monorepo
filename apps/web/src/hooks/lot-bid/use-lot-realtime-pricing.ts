"use client";

import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import {
  type LotReserveContext,
  resolveEndedBanner,
  resolveLotReserveContext,
} from "@/lib/lot/reserve-presentation";
import { notify } from "@/lib/ui/notify";
import type { Lot, LotEndedNoSaleReason, PublicLotView } from "@auction/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseLotRealtimePricingParams = {
  auction: Lot | PublicLotView;
  sessionUser: SessionUser | null;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  initialUserHasBid?: boolean;
};

export type UseLotRealtimePricingResult = {
  currentPrice: string;
  endTime: number;
  startTimeMs: number;
  lotStatus: Lot["status"];
  leadingBidderId: string | null;
  history: BidHistoryEntry[];
  activeAutoBid: AutoBidSettings | null;
  setActiveAutoBid: (settings: AutoBidSettings | null) => void;
  handleAutoBidSaved: (settings: AutoBidSettings | null) => void;
  priceFlash: boolean;
  reserveContext: LotReserveContext;
  outbidSignal: boolean;
  userHasBid: boolean;
  endedBanner: string | null;
  noSaleReason: LotEndedNoSaleReason | null;
  applyOwnBidResult: (bid: {
    id: string;
    amount: string;
    bidderId?: string | null | undefined;
    placedByUserId?: string | null | undefined;
    maxAutoBidAmount?: string | null | undefined;
    autoBidStepAmount?: string | null | undefined;
  }) => void;
  markLotEndedLocally: (banner: string) => void;
};

export function useLotRealtimePricing({
  auction,
  sessionUser,
  initialAutoBidSettings = null,
  initialOutbid = false,
  initialUserHasBid = false,
}: UseLotRealtimePricingParams): UseLotRealtimePricingResult {
  const {
    entries: history,
    currentPrice,
    leadingBidderId,
    applyOwnBid,
    setEndedWinner,
    latestSnapshotReserveMet,
  } = useLotBidHistory();
  const onlineLifecycle = useOnlineLotLifecycle();

  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const startTimeMs = useMemo(() => new Date(auction.startTime).getTime(), [auction.startTime]);
  const [lotStatus, setLotStatus] = useState<Lot["status"]>(auction.status);
  const [activeAutoBid, setActiveAutoBid] = useState<AutoBidSettings | null>(
    initialAutoBidSettings,
  );
  const [priceFlash, setPriceFlash] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
  const [noSaleReason, setNoSaleReason] = useState<LotEndedNoSaleReason | null>(null);
  const [outbidSignal, setOutbidSignal] = useState(initialOutbid);
  const [userHasBid, setUserHasBid] = useState(initialUserHasBid);
  const [liveReserveMet, setLiveReserveMet] = useState<boolean | undefined>(undefined);

  const endTimeRef = useRef(endTime);
  endTimeRef.current = endTime;

  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPriceFlash = useCallback(() => {
    setPriceFlash(true);
    if (flashTimeoutRef.current != null) {
      clearTimeout(flashTimeoutRef.current);
    }
    flashTimeoutRef.current = setTimeout(() => {
      setPriceFlash(false);
      flashTimeoutRef.current = null;
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimeoutRef.current != null) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  const handleAutoBidSaved = useCallback((settings: AutoBidSettings | null) => {
    setActiveAutoBid(settings);
  }, []);

  useLotRealtime(auction.id, {
    onBidUpdate: (e) => {
      triggerPriceFlash();
      onlineLifecycle?.setExtendedDeltaMs(null);
      if (sessionUser?.id && e.outbidUserId === sessionUser.id) {
        setOutbidSignal(true);
      }
      if (
        sessionUser?.id &&
        (e.bidderId === sessionUser.id || e.placedByUserId === sessionUser.id)
      ) {
        setUserHasBid(true);
        if (e.bidderId === sessionUser.id) {
          setOutbidSignal(false);
        }
      }
      if (typeof e.reserveMet === "boolean") {
        setLiveReserveMet(e.reserveMet);
      }
    },
    onLotExtended: (payload) => {
      const p = payload as { newEndTime?: string };
      if (!p?.newEndTime) return;
      const newMs = new Date(p.newEndTime).getTime();
      const prev = endTimeRef.current;
      const delta = Math.max(0, newMs - prev);
      setEndTime(newMs);
      onlineLifecycle?.setLiveEndTimeMs(newMs);
      if (delta > 0) {
        onlineLifecycle?.setExtendedDeltaMs(delta);
        const bidCardVisible = onlineLifecycle?.bidCardInView ?? true;
        if (!bidCardVisible) {
          notify.info("Closing time extended", {
            id: `lot-extend-${auction.id}`,
            description: `A bid near the closing time added ${Math.round(delta / 1000)}s to this lot's clock.`,
            duration: 7000,
          });
        }
      }
    },
    onLotEnded: (p) => {
      setLotStatus("ended");
      setEndedWinner(p.winnerId ?? null, p.currentPrice);
      const noSale = Boolean(p.noSale) || p.outcome === "no_sale" || !p.winnerId;
      const reason = p.noSaleReason ?? (noSale ? "reserve_not_met" : null);
      setNoSaleReason(reason ?? null);
      onlineLifecycle?.setLiveLotEnded({
        winnerId: p.winnerId ?? null,
        noSale,
      });
      if (noSale) {
        const isHighBidder = Boolean(
          sessionUser?.id && leadingBidderId && leadingBidderId === sessionUser.id,
        );
        setEndedBanner(
          resolveEndedBanner({
            ...(reason ? { noSaleReason: reason } : {}),
            isHighBidder,
          }),
        );
      } else if (sessionUser?.id && p.winnerId === sessionUser.id) {
        setEndedBanner("You won this lot — complete checkout from your dashboard.");
      } else {
        setEndedBanner("This lot has sold — thank you for participating.");
      }
    },
    onLotEvent: (payload) => {
      if (!sessionUser?.id || !payload || typeof payload !== "object") return;
      const o = payload as Record<string, unknown>;
      if (o.type !== "proxy_cancelled") return;
      if (o.bidderUserId !== sessionUser.id) return;
      handleAutoBidSaved(null);
      notify.warning("Auto-bid cancelled", {
        id: `proxy-cancelled-${auction.id}`,
        description: "Your auto-bid on this lot was cleared by the saleroom.",
        duration: 8000,
      });
    },
  });

  useEffect(() => {
    if (onlineLifecycle?.liveEndTimeMs != null) {
      setEndTime(onlineLifecycle.liveEndTimeMs);
    }
  }, [onlineLifecycle?.liveEndTimeMs]);

  useEffect(() => {
    if (onlineLifecycle?.liveLotStatus != null) {
      setLotStatus(onlineLifecycle.liveLotStatus);
    }
  }, [onlineLifecycle?.liveLotStatus]);

  useEffect(() => {
    if (latestSnapshotReserveMet !== undefined) {
      setLiveReserveMet(latestSnapshotReserveMet);
    }
  }, [latestSnapshotReserveMet]);

  const reserveContext = useMemo((): LotReserveContext => {
    const base = resolveLotReserveContext(auction, currentPrice);
    if (liveReserveMet !== undefined && base.hasReserve) {
      return { hasReserve: true, reserveMet: liveReserveMet };
    }
    return base;
  }, [auction, currentPrice, liveReserveMet]);

  const markLotEndedLocally = useCallback((banner: string) => {
    setLotStatus("ended");
    setEndedBanner(banner);
  }, []);

  const applyOwnBidResult = useCallback(
    (bid: {
      id: string;
      amount: string;
      bidderId?: string | null | undefined;
      placedByUserId?: string | null | undefined;
      maxAutoBidAmount?: string | null | undefined;
      autoBidStepAmount?: string | null | undefined;
    }) => {
      setOutbidSignal(false);
      setUserHasBid(true);
      applyOwnBid({
        id: bid.id,
        amount: bid.amount,
        bidderId: bid.bidderId ?? null,
        placedByUserId: bid.placedByUserId ?? null,
        ...(bid.maxAutoBidAmount ? { isAutoBid: true } : {}),
        placedVia: "web",
      });
      if (bid.maxAutoBidAmount) {
        setActiveAutoBid({
          maxAutoBidAmount: bid.maxAutoBidAmount,
          autoBidStepAmount: bid.autoBidStepAmount ?? null,
          isActive: true,
        });
      }
      triggerPriceFlash();
    },
    [applyOwnBid, triggerPriceFlash],
  );

  return {
    currentPrice,
    endTime,
    startTimeMs,
    lotStatus,
    leadingBidderId,
    history,
    activeAutoBid,
    setActiveAutoBid,
    handleAutoBidSaved,
    priceFlash,
    reserveContext,
    outbidSignal,
    userHasBid,
    endedBanner,
    noSaleReason,
    applyOwnBidResult,
    markLotEndedLocally,
  };
}
