"use client";

import { LotLifecycleStatusBadge } from "@/components/marketing/lot-lifecycle-status-badge";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import {
  type LotLifecycle,
  classifyLotLifecycle,
  lifecycleBadge,
  saleroomOnBlockBadge,
} from "@/lib/lot/lot-lifecycle";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { useEffect, useMemo, useState } from "react";

type LotPick = Pick<
  Lot,
  "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
>;
type SalePick =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

type Props = {
  lot: LotPick;
  sale: SalePick;
  className?: string;
  /** Smaller typography for sidebar mirror */
  compact?: boolean;
  /** Hide countdown entirely. */
  suppressCountdown?: boolean;
  /** Hide countdown below `lg` (mobile sticky bar owns the timer). */
  hideCountdownOnMobile?: boolean;
  /** First `Date.now()` tick (e.g. from server render) so pill matches SSR lifecycle. */
  initialNowMs?: number;
};

function lifecycleDetail(
  lifecycle: LotLifecycle,
  opts?: { isOnBlock?: boolean; isSessionLive?: boolean },
): string | null {
  const isOnBlock = opts?.isOnBlock ?? false;
  const isSessionLive = opts?.isSessionLive ?? false;
  switch (lifecycle.kind) {
    case "preLaunch":
      return "This lot is in preview — bidding has not opened yet.";
    case "scheduled":
      return "Bidding opens soon — register to bid before the auctioneer starts the sale.";
    case "liveSaleroom":
      if (isOnBlock) {
        return "This lot is on the block in the saleroom — bidding closes when the auctioneer hammers.";
      }
      if (!isSessionLive) {
        return "This lot is sold live in the saleroom — online bidding opens when the auctioneer starts the sale.";
      }
      return "The saleroom session is live — lots close when the auctioneer hammers, not on a countdown timer.";
    case "saleroomPaused":
      return "The auction is paused — bidding will resume when the auctioneer continues.";
    case "endedSold":
    case "endedNoSale":
    case "cancelled":
    case "withdrawn":
      return "Bidding is closed for this lot.";
    default:
      return null;
  }
}

/** Live-updating pill + short countdown for scheduled / live / extended. */
export function LotStatePill({
  lot,
  sale,
  className,
  compact,
  suppressCountdown = false,
  hideCountdownOnMobile = false,
  initialNowMs,
}: Props) {
  const [now, setNow] = useState<number | null>(() => initialNowMs ?? null);
  const onlineCtx = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const isOnBlock = saleroomLive?.isLotOnBlock(lot.id) ?? false;
  const isSessionLive = saleroomLive?.isSessionLive ?? false;

  useEffect(() => {
    setNow((cur) => cur ?? Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const recentlyExtended = onlineCtx?.extendedByMs != null && onlineCtx.extendedByMs > 0;
  const lifecycle = useMemo(
    () =>
      classifyLotLifecycle(lot, sale, now ?? 0, {
        recentlyExtended,
        saleroomSessionPaused: saleroomLive?.status === "paused",
        saleroomSessionActive: saleroomLive?.isSessionLive ?? false,
        isOnBlock,
      }),
    [
      lot,
      sale,
      now,
      recentlyExtended,
      saleroomLive?.status,
      saleroomLive?.isSessionLive,
      isOnBlock,
    ],
  );
  const badge = useMemo(() => {
    if (lifecycle.kind === "liveSaleroom" && isOnBlock) {
      return saleroomOnBlockBadge();
    }
    if (lifecycle.kind === "liveSaleroom" && !isSessionLive) {
      return { label: "Saleroom lot", tone: "upcoming" as const, pulse: false };
    }
    return lifecycleBadge(lifecycle);
  }, [lifecycle, isOnBlock, isSessionLive]);
  const detail = useMemo(
    () => lifecycleDetail(lifecycle, { isOnBlock, isSessionLive }),
    [lifecycle, isOnBlock, isSessionLive],
  );

  const countdown =
    now != null &&
    lifecycle.msLeft != null &&
    lifecycle.kind !== "liveSaleroom" &&
    lifecycle.kind !== "saleroomPaused" &&
    (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
      ? formatCountdownForDisplay(lifecycle.msLeft)
      : null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <LotLifecycleStatusBadge badge={badge} size={compact ? "sm" : "md"} />
        {countdown && !suppressCountdown ? (
          <span
            className={cn(
              "font-body tabular-nums text-on-surface-variant",
              compact ? "text-xs" : "text-sm",
              hideCountdownOnMobile && "hidden lg:inline",
            )}
            suppressHydrationWarning
          >
            {countdown}
          </span>
        ) : null}
      </div>
      {detail ? (
        <p className={cn("font-body text-on-surface-variant", compact ? "text-xs" : "text-sm")}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
