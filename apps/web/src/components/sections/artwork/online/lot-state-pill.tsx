"use client";

import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import {
  type LifecycleBadgeTone,
  type LotLifecycle,
  classifyLotLifecycle,
  lifecycleBadge,
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

function toneClasses(tone: LifecycleBadgeTone): string {
  switch (tone) {
    case "live":
      return "border-error/30 bg-error/10 text-error";
    case "upcoming":
      return "border-lot-orange/30 bg-lot-orange/10 text-lot-orange";
    case "warn":
      return "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "ended":
      return "border-outline-variant/40 bg-surface-container-high/80 text-on-surface-variant";
    case "muted":
      return "border-outline-variant/40 bg-surface-container-high/60 text-on-surface-variant";
  }
}

function lifecycleDetail(lifecycle: LotLifecycle, isOnBlock?: boolean): string | null {
  switch (lifecycle.kind) {
    case "preLaunch":
      return "This lot is in preview — bidding has not opened yet.";
    case "scheduled":
      return "Bidding opens soon — register to bid before the lot goes live.";
    case "liveSaleroom":
      return isOnBlock
        ? "This lot is on the block in the saleroom — bidding closes when the auctioneer hammers."
        : "The saleroom session is live — lots close when the auctioneer hammers, not on a countdown timer.";
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
  // When server passes `initialNowMs`, SSR and CSR start aligned. Otherwise fall
  // back to `null` until mount to avoid a hydration mismatch on the countdown text.
  const [now, setNow] = useState<number | null>(() => initialNowMs ?? null);
  const onlineCtx = useOnlineLotLifecycle();
  const saleroomLive = useSaleroomLive();
  const isOnBlock = saleroomLive?.isLotOnBlock(lot.id) ?? false;

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
      return { label: "On the block", tone: "live" as const, pulse: true };
    }
    return lifecycleBadge(lifecycle);
  }, [lifecycle, isOnBlock]);
  const detail = useMemo(() => lifecycleDetail(lifecycle, isOnBlock), [lifecycle, isOnBlock]);

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
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-label font-bold uppercase tracking-wide",
            compact ? "text-[10px]" : "text-xs",
            toneClasses(badge.tone),
          )}
        >
          {badge.pulse ? (
            <span
              className="relative flex h-3 w-3 shrink-0 items-center justify-center"
              aria-hidden
            >
              <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-current/60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
          ) : null}
          <span>{badge.label}</span>
        </span>
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
