"use client";

import { mapUserBidsHistoryVM } from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { UserBidsHistory } from "@/components/sections/artwork/online/user-bids-history";
import { LiveBidFeed } from "@/components/sections/artwork/onsite/live-bid-feed";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useNow } from "@/hooks/use-now";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { Lot, LotEndedEvent } from "@auction/types";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  lotId: string;
  lot: Pick<Lot, "status" | "winnerId">;
  initialHistory: BidHistoryEntry[];
  currentUserId: string | null;
  /** Presence-tracked count when available (shown when lot is live). */
  watcherCount?: number | null;
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
  children,
  className,
}: Props) {
  const now = useNow();
  const onlineCtx = useOnlineLotLifecycle();
  const [entries, setEntries] = useState<BidHistoryEntry[]>(initialHistory);
  const [lotSnap, setLotSnap] = useState(() => ({
    status: lot.status,
    winnerId: lot.winnerId ?? null,
  }));

  useEffect(() => {
    setEntries(initialHistory);
  }, [initialHistory]);

  useEffect(() => {
    setLotSnap({
      status: lot.status,
      winnerId: lot.winnerId ?? null,
    });
  }, [lot.status, lot.winnerId]);

  const onBidUpdate = useCallback((e: { bidId: string; bidderId: string; amount: string }) => {
    setEntries((prev) => {
      const next: BidHistoryEntry = {
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
        at: Date.now(),
      };
      return [next, ...prev].filter((x, i, arr) => arr.findIndex((y) => y.id === x.id) === i);
    });
  }, []);

  useLotRealtime(lotId, {
    onBidUpdate: (e) => {
      onBidUpdate({
        bidId: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
    },
    onLotEnded: (p) => {
      const ev = p as LotEndedEvent;
      setLotSnap({ status: "ended", winnerId: ev.winnerId ?? null });
    },
  });

  const userBidsVm = useMemo(
    () =>
      mapUserBidsHistoryVM(entries, currentUserId, {
        status: lotSnap.status,
        winnerId: lotSnap.winnerId,
      }),
    [entries, currentUserId, lotSnap.status, lotSnap.winnerId],
  );

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
    return classifyLotLifecycle(onlineCtx.lot, onlineCtx.sale, now ?? 0, {
      recentlyExtended: Boolean(onlineCtx.extendedByMs && onlineCtx.extendedByMs > 0),
    });
  }, [onlineCtx, lotId, lotSnap, now]);

  const countdownClock = useMemo(() => {
    if (
      lifecycle.msLeft != null &&
      (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
    ) {
      return formatCountdownForDisplay(lifecycle.msLeft);
    }
    return "";
  }, [lifecycle]);

  return (
    <div className={cn("flex w-full min-w-0 flex-col gap-6", className)}>
      <LiveBidFeed
        lotId={lotId}
        initialHistory={initialHistory}
        currentUserId={currentUserId}
        headerMode="watching"
        watcherCount={watcherCount}
        lifecycleKind={lifecycle.kind}
        countdownClock={countdownClock}
        listMaxHeightClass="max-h-[40vh] md:max-h-[50vh] lg:max-h-[min(55vh,520px)]"
        className="lg:max-w-none"
      />
      {children}
      {userBidsVm ? <UserBidsHistory vm={userBidsVm} /> : null}
    </div>
  );
}
