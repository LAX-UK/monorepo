"use client";

import { classifyLotTimerState } from "@/components/lot-timer";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useNow } from "@/hooks/use-now";
import { type LotBidPosition, deriveLotBidPosition } from "@/lib/bid/derive-lot-bid-position";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { type LotLifecycle, classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { notify } from "@/lib/ui/notify";
import type { Lot, Sale } from "@auction/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type UseLotBidStateParams = {
  auction: Lot;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  initialAutoBidSettings?: AutoBidSettings | null;
  initialOutbid?: boolean;
  initialUserHasBid?: boolean;
  saleForLifecycle?: Pick<Sale, "status" | "deliveryMode"> | null;
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
  lifecycle: LotLifecycle;
  countdownClock: string;
  timerState: ReturnType<typeof classifyLotTimerState>;
  remainingLabel: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
  position: LotBidPosition;
  biddingLive: boolean;
  priceFlash: boolean;
  endedBanner: string | null;
  outbidSignal: boolean;
  userHasBid: boolean;
  applyOwnBidResult: (bid: {
    id: string;
    amount: string;
    bidderId?: string | null | undefined;
    placedByUserId?: string | null | undefined;
    maxAutoBidAmount?: string | null | undefined;
    autoBidStepAmount?: string | null | undefined;
  }) => void;
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
  const {
    entries: history,
    currentPrice,
    leadingBidderId,
    applyOwnBid,
    setEndedWinner,
  } = useLotBidHistory();
  const onlineLifecycle = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const now = useNow();

  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const startTimeMs = useMemo(() => new Date(auction.startTime).getTime(), [auction.startTime]);
  const [lotStatus, setLotStatus] = useState<Lot["status"]>(auction.status);
  const [activeAutoBid, setActiveAutoBid] = useState<AutoBidSettings | null>(
    initialAutoBidSettings,
  );
  const [priceFlash, setPriceFlash] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
  const [outbidSignal, setOutbidSignal] = useState(initialOutbid);
  const [userHasBid, setUserHasBid] = useState(initialUserHasBid);

  const endTimeRef = useRef(endTime);
  endTimeRef.current = endTime;

  const triggerPriceFlash = useCallback(() => {
    setPriceFlash(true);
    window.setTimeout(() => setPriceFlash(false), 500);
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
            description: `Anti-snipe added ${Math.round(delta / 1000)}s to the clock.`,
            duration: 7000,
          });
        }
      }
    },
    onLotEnded: (p) => {
      setLotStatus("ended");
      setEndedWinner(p.winnerId ?? null, p.currentPrice);
      const noSale = Boolean(p.noSale) || !p.winnerId;
      if (noSale) {
        setEndedBanner("Reserve not met — this lot passed unsold.");
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

  const lifecycleLot = useMemo(
    () => ({
      id: auction.id,
      status: lotStatus,
      startTime: new Date(startTimeMs),
      endTime: new Date(endTime),
      winnerId: lotStatus === "ended" ? leadingBidderId : auction.winnerId,
      reservePrice: auction.reservePrice,
      currentPrice,
    }),
    [
      auction.id,
      auction.winnerId,
      auction.reservePrice,
      lotStatus,
      startTimeMs,
      endTime,
      currentPrice,
      leadingBidderId,
    ],
  );

  const lifecycle = useMemo(
    () =>
      classifyLotLifecycle(lifecycleLot, saleForLifecycle, now ?? 0, {
        recentlyExtended: Boolean(
          onlineLifecycle?.extendedByMs && onlineLifecycle.extendedByMs > 0,
        ),
        saleroomSessionPaused: saleroomLive?.status === "paused",
        saleroomSessionActive: saleroomLive?.isSessionLive ?? false,
        isOnBlock: saleroomLive?.isLotOnBlock(auction.id) ?? false,
      }),
    [lifecycleLot, saleForLifecycle, now, onlineLifecycle?.extendedByMs, saleroomLive, auction.id],
  );

  const remainingLabel = now != null ? formatCountdownForDisplay(endTime - now) : "";

  const saleEndLocalLabel = useMemo(() => {
    const d = new Date(endTime);
    return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }, [endTime]);

  const saleStartLocalLabel = useMemo(() => {
    const d = new Date(startTimeMs);
    return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }, [startTimeMs]);

  const timerState = useMemo(
    () =>
      classifyLotTimerState(
        {
          status: lotStatus,
          startTime: new Date(startTimeMs).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
        now,
      ),
    [lotStatus, startTimeMs, endTime, now],
  );

  const countdownClock = useMemo(() => {
    if (now == null) return "";
    if (
      lifecycle.msLeft != null &&
      (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
    ) {
      return formatCountdownForDisplay(lifecycle.msLeft);
    }
    return remainingLabel;
  }, [lifecycle, remainingLabel, now]);

  const position = useMemo(
    () =>
      deriveLotBidPosition({
        sessionUserId: sessionUser?.id ?? null,
        sellerId: auction.sellerId ?? null,
        isOwnLot,
        lotStatus,
        lifecycleKind: lifecycle.kind,
        leadingBidderId,
        winnerId:
          lotStatus === "ended"
            ? (leadingBidderId ?? auction.winnerId ?? null)
            : (auction.winnerId ?? null),
        userHasBid,
        outbidSignal,
        activeAutoBid,
        endedBanner,
      }),
    [
      sessionUser?.id,
      auction.sellerId,
      isOwnLot,
      auction.winnerId,
      lotStatus,
      lifecycle.kind,
      leadingBidderId,
      userHasBid,
      outbidSignal,
      activeAutoBid,
      endedBanner,
    ],
  );

  const biddingLive = lotStatus === "active";

  const msRemaining = now != null ? Math.max(0, endTime - now) : 0;

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
    currentPrice,
    endTime,
    startTimeMs,
    lotStatus,
    leadingBidderId,
    history,
    activeAutoBid,
    setActiveAutoBid,
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
    endedBanner,
    outbidSignal,
    userHasBid,
    applyOwnBidResult,
    scrollToBid,
    scrollToAutoBid,
    extendedByMs: onlineLifecycle?.extendedByMs ?? null,
    msRemaining,
    markLotEndedLocally,
  };
}
