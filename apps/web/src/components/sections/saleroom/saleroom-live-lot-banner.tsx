"use client";

import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { isLotRunCompleted } from "@/lib/saleroom/lot-run-progress";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import { cn } from "@auction/ui";
import { LiveDot } from "@auction/ui";
import Link from "next/link";

export type SaleroomLiveLotRef = {
  id: string;
  lotNumber: number | null;
  title: string;
  href: string;
  status: string;
};

type Props = {
  lots: SaleroomLiveLotRef[];
  /** When set, banner only shows if viewed lot differs from on-block lot. */
  viewedLotId?: string | null;
  className?: string;
};

export function SaleroomLiveLotBanner({ lots, viewedLotId = null, className }: Props) {
  const live = useSaleroomLive();
  if (!live || !isSaleroomSessionActive(live.status)) return null;

  const onBlockLot =
    live.currentLotId != null ? lots.find((l) => l.id === live.currentLotId) : null;

  if (viewedLotId != null && live.currentLotId === viewedLotId) return null;
  if (viewedLotId != null && !onBlockLot) return null;

  const totalLots = lots.length;
  const completedLots = lots.filter((l) => isLotRunCompleted(l.status as "ended")).length;

  if (live.status === "paused") {
    return (
      <div
        className={cn(
          "sticky top-[var(--header-height)] z-20 border-b border-outline-variant/25 bg-amber-500/10 px-4 py-3",
          className,
        )}
      >
        <p className="font-body text-sm text-on-surface">
          <span className="font-medium">Auction paused</span>
          {onBlockLot ? (
            <span className="text-on-surface-variant">
              {" "}
              · Lot {onBlockLot.lotNumber ?? "—"} was on the block
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  if (!isSaleroomSessionLive(live.status)) return null;

  if (!onBlockLot && live.currentLotId == null) {
    return (
      <div
        className={cn(
          "sticky top-[var(--header-height)] z-20 border-b border-outline-variant/25 bg-surface-container-low px-4 py-3",
          className,
        )}
      >
        <p className="font-body text-sm text-on-surface-variant">
          Saleroom live · {completedLots} of {totalLots} lots complete
        </p>
      </div>
    );
  }

  if (!onBlockLot) return null;

  const lotLabel = onBlockLot.lotNumber != null ? `Lot ${onBlockLot.lotNumber}` : onBlockLot.title;

  return (
    <div
      className={cn(
        "sticky top-[var(--header-height)] z-20 border-b border-error/20 bg-error/5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LiveDot className="live-dot-pulse h-2 w-2 shrink-0 text-error" />
          <p className="font-body text-sm text-on-surface">
            <span className="font-medium">{lotLabel} is on the block</span>
            {totalLots > 0 ? (
              <span className="text-on-surface-variant">
                {" "}
                · {completedLots + (live.currentLotId ? 1 : 0)} of {totalLots} lots
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href={onBlockLot.href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-primary px-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary"
        >
          Bid now →
        </Link>
      </div>
    </div>
  );
}
