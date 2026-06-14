"use client";

import {
  type UserBidsHistoryVM,
  mapUserBidsHistoryVM,
} from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { prependBidHistoryEntry } from "@/components/sections/artwork/bid-history-utils";
import { UserBidsHistory } from "@/components/sections/artwork/online/user-bids-history";
import { LiveBidFeed } from "@/components/sections/artwork/onsite/live-bid-feed";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useNow } from "@/hooks/use-now";
import { shouldSkipOwnBidEcho } from "@/lib/bid/own-bid-echo-guard";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { Lot, LotEndedEvent } from "@auction/types";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  lotId: string;
  lot: Pick<Lot, "status" | "winnerId">;
  initialHistory: BidHistoryEntry[];
  currentUserId: string | null;
  watcherCount?: number | null;
  /** Omit duplicate countdown in feed header (pricing header owns the clock). */
  compactFeedHeader?: boolean;
  initialOutbid?: boolean;
  currentPrice?: string;
  children: ReactNode;
  className?: string;
};

/** Online mockup: live feed + bid panel + your bids history (composition only). */
export function OnlineBidsView({
  lotId,
  lot,
  initialHistory,
  currentUserId,
  watcherCount = null,
  compactFeedHeader = false,
  initialOutbid = false,
  currentPrice = "0",
  children,
  className,
}: Props) {
  const now = useNow();
  const onlineCtx = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const [entries, setEntries] = useState<BidHistoryEntry[]>(initialHistory);
  const [liveCurrentPrice, setLiveCurrentPrice] = useState(currentPrice);
  const [lotSnap, setLotSnap] = useState(() => ({
    status: lot.status,
    winnerId: lot.winnerId ?? null,
  }));

  useEffect(() => {
    setLiveCurrentPrice(currentPrice);
  }, [currentPrice]);

  useEffect(() => {
    setEntries(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    setLotSnap({
      status: lot.status,
      winnerId: lot.winnerId ?? null,
    });
  }, [lot.status, lot.winnerId]);

  useLotRealtime(lotId, {
    onBidUpdate: (e) => {
      if (shouldSkipOwnBidEcho(e, onlineCtx?.ownBidEchoGuardRef.current ?? null, currentUserId)) {
        return;
      }

      setLiveCurrentPrice(e.currentPrice);
      setEntries((prev) =>
        prependBidHistoryEntry(prev, {
          id: e.bidId,
          bidderId: e.bidderId,
          amount: e.amount,
          ...(e.isAutoBid ? { isAutoBid: true } : {}),
          ...(e.placedVia ? { placedVia: e.placedVia } : {}),
        }),
      );
    },
    onLotEnded: (p) => {
      const ev = p as LotEndedEvent;
      setLotSnap({ status: "ended", winnerId: ev.winnerId ?? null });
    },
  });

  const userBidsVmBase = useMemo(
    () =>
      mapUserBidsHistoryVM(entries, currentUserId, {
        status: lotSnap.status,
        winnerId: lotSnap.winnerId,
      }),
    [entries, currentUserId, lotSnap.status, lotSnap.winnerId],
  );

  const userBidsVm = useMemo((): UserBidsHistoryVM | null => {
    if (!userBidsVmBase) return null;
    if (!initialOutbid || !currentUserId) return userBidsVmBase;
    const myLatest = entries.find((e) => e.bidderId === currentUserId);
    if (!myLatest) return userBidsVmBase;
    return {
      ...userBidsVmBase,
      contextLine: `Your last bid ${formatMoney(myLatest.amount)} — current high ${formatMoney(liveCurrentPrice)}`,
    };
  }, [userBidsVmBase, initialOutbid, currentUserId, entries, liveCurrentPrice]);

  const lifecycle = useMemo(() => {
    if (!onlineCtx) {
      return classifyLotLifecycle(
        {
          id: lotId,
          status: lotSnap.status,
          startTime: new Date(),
          endTime: new Date(),
          winnerId: lotSnap.winnerId,
          reservePrice: null,
          currentPrice: "0",
        },
        null,
        now ?? 0,
      );
    }
    return classifyLotLifecycle(
      {
        ...onlineCtx.lot,
        status: lotSnap.status,
        winnerId: lotSnap.winnerId,
      },
      onlineCtx.sale,
      now ?? 0,
      {
        recentlyExtended: Boolean(onlineCtx.extendedByMs && onlineCtx.extendedByMs > 0),
        saleroomSessionActive: saleroomLive?.isSessionActive ?? false,
        isOnBlock: saleroomLive?.isLotOnBlock(lotId) ?? false,
      },
    );
  }, [onlineCtx, lotId, lotSnap, now, saleroomLive]);

  const countdownClock = useMemo(() => {
    if (now == null) return "";
    if (
      lifecycle.msLeft != null &&
      (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
    ) {
      return formatCountdownForDisplay(lifecycle.msLeft);
    }
    return "";
  }, [lifecycle, now]);

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-6", className)}>
      <LiveBidFeed
        entries={entries}
        currentUserId={currentUserId}
        headerMode="watching"
        watcherCount={watcherCount}
        lifecycleKind={lifecycle.kind}
        countdownClock={countdownClock}
        compactHeader={compactFeedHeader}
        listMaxHeightClass="max-h-[40vh] md:max-h-[50vh] lg:max-h-[min(55vh,520px)]"
        className="lg:max-w-none"
      />
      {children}
      {userBidsVm ? (
        <UserBidsHistory vm={userBidsVm} defaultOpen={Boolean(userBidsVm.rows.length)} />
      ) : null}
    </div>
  );
}
