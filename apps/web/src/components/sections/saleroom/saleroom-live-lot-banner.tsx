"use client";

import { LotLifecycleStatusBadge } from "@/components/marketing/lot-lifecycle-status-badge";
import { SaleroomSessionCaption } from "@/components/marketing/saleroom-session-caption";
import { SaleroomSessionStatusBadge } from "@/components/marketing/saleroom-session-status-badge";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { saleroomOnBlockBadge } from "@/lib/lot/lot-lifecycle";
import { participationWarningBandClassName } from "@/lib/presenters/participation-warning-presentation";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import {
  type SaleroomLotRef,
  countSaleroomLotProgress,
  saleroomBidNowCtaClassName,
  saleroomLiveNoLotCaption,
  saleroomLiveProgressLabel,
  saleroomOnBlockCaption,
  saleroomPausedCaption,
} from "@/lib/saleroom/saleroom-mobile-chrome";
import { cn } from "@auction/ui";
import Link from "next/link";

export type { SaleroomLotRef, SaleroomLiveLotRef } from "@/lib/saleroom/saleroom-mobile-chrome";

type Props = {
  lots: SaleroomLotRef[];
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

  const { completedLots, totalLots } = countSaleroomLotProgress(lots);

  if (live.status === "paused") {
    return (
      <div
        className={cn(
          "border-b border-outline-variant/25 px-4 py-3",
          participationWarningBandClassName,
          className,
        )}
      >
        <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-wrap items-center gap-2">
          <SaleroomSessionStatusBadge status={live.status} />
          <SaleroomSessionCaption caption={saleroomPausedCaption(onBlockLot ?? null)} />
        </div>
      </div>
    );
  }

  if (!isSaleroomSessionLive(live.status)) return null;

  if (!onBlockLot && live.currentLotId == null) {
    return (
      <div
        className={cn(
          "border-b border-outline-variant/25 bg-surface-container-low px-4 py-3",
          className,
        )}
      >
        <p className="font-body text-sm text-on-surface-variant">
          {saleroomLiveNoLotCaption(completedLots, totalLots)}
        </p>
      </div>
    );
  }

  if (!onBlockLot) return null;

  const progressLabel = saleroomLiveProgressLabel(
    completedLots,
    totalLots,
    Boolean(live.currentLotId),
  );

  return (
    <div className={cn("border-b border-live-red/20 bg-live-red/5 px-4 py-3", className)}>
      <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <LotLifecycleStatusBadge badge={saleroomOnBlockBadge()} size="sm" />
          <SaleroomSessionCaption caption={saleroomOnBlockCaption(onBlockLot, progressLabel)} />
        </div>
        <Link href={onBlockLot.href} className={saleroomBidNowCtaClassName}>
          Bid now →
        </Link>
      </div>
    </div>
  );
}
