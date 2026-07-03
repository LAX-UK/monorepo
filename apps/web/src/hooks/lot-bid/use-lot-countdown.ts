"use client";

import { classifyLotTimerState } from "@/components/lot-timer";
import { useNow } from "@/hooks/use-now";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { type LotLifecycle, classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { useMemo } from "react";

export type UseLotCountdownParams = {
  auction: Lot | PublicLotView;
  endTime: number;
  startTimeMs: number;
  lotStatus: Lot["status"];
  currentPrice: string;
  leadingBidderId: string | null;
  saleForLifecycle?:
    | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
    | null;
};

export type UseLotCountdownResult = {
  lifecycle: LotLifecycle;
  countdownClock: string;
  timerState: ReturnType<typeof classifyLotTimerState>;
  remainingLabel: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
  biddingLive: boolean;
  extendedByMs: number | null;
  msRemaining: number;
};

export function useLotCountdown({
  auction,
  endTime,
  startTimeMs,
  lotStatus,
  currentPrice,
  leadingBidderId,
  saleForLifecycle = null,
}: UseLotCountdownParams): UseLotCountdownResult {
  const onlineLifecycle = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const now = useNow();

  const lifecycleLot = useMemo(
    () => ({
      id: auction.id,
      status: lotStatus,
      startTime: new Date(startTimeMs),
      endTime: new Date(endTime),
      winnerId: lotStatus === "ended" ? leadingBidderId : auction.winnerId,
      currentPrice,
      reservePrice: "reservePrice" in auction ? auction.reservePrice : null,
    }),
    [auction, lotStatus, startTimeMs, endTime, currentPrice, leadingBidderId],
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

  const biddingLive = lotStatus === "active";
  const msRemaining = now != null ? Math.max(0, endTime - now) : 0;

  return {
    lifecycle,
    countdownClock,
    timerState,
    remainingLabel,
    saleEndLocalLabel,
    saleStartLocalLabel,
    biddingLive,
    extendedByMs: onlineLifecycle?.extendedByMs ?? null,
    msRemaining,
  };
}
