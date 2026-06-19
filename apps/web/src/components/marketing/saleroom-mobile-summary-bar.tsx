"use client";

import { LotLifecycleStatusBadge } from "@/components/marketing/lot-lifecycle-status-badge";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { SaleroomSessionCaption } from "@/components/marketing/saleroom-session-caption";
import { SaleroomSessionStatusBadge } from "@/components/marketing/saleroom-session-status-badge";
import { saleroomOnBlockBadge } from "@/lib/lot/lot-lifecycle";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import {
  type SaleroomMobileSummaryBarMode,
  saleroomBidNowCtaClassName,
  saleroomOnBlockCaption,
  saleroomPausedCaption,
} from "@/lib/saleroom/saleroom-mobile-chrome";
import Link from "next/link";

const viewLotsCtaClassName =
  "shrink-0 rounded-sm border border-outline-variant/40 px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";

type Props = {
  mode: Exclude<SaleroomMobileSummaryBarMode, { kind: "live_no_lot" }>;
  saleTitle: string;
  /** When false (staff viewers), hide bid-now and show view-lots instead. Defaults to true. */
  canParticipate?: boolean;
};

/** Hybrid saleroom sticky bottom bar for on-block and paused session states. */
export function SaleroomMobileSummaryBar({ mode, saleTitle, canParticipate = true }: Props) {
  if (mode.kind === "on_block") {
    return (
      <MarketingStickyBidBar innerClassName={MARKETING_PAGE_INNER}>
        <div className="min-w-0 flex flex-col gap-1">
          <LotLifecycleStatusBadge badge={saleroomOnBlockBadge()} size="sm" />
          <span className="sr-only">{saleTitle}</span>
          <SaleroomSessionCaption caption={saleroomOnBlockCaption(mode.lot, mode.progressLabel)} />
        </div>
        {canParticipate ? (
          <Link href={mode.lot.href} className={saleroomBidNowCtaClassName}>
            Bid now →
          </Link>
        ) : (
          <Link href="#catalog" className={viewLotsCtaClassName}>
            View lots
          </Link>
        )}
      </MarketingStickyBidBar>
    );
  }

  return (
    <MarketingStickyBidBar innerClassName={MARKETING_PAGE_INNER}>
      <div className="min-w-0 flex flex-col gap-1">
        <SaleroomSessionStatusBadge status="paused" />
        <span className="sr-only">{saleTitle}</span>
        <SaleroomSessionCaption caption={saleroomPausedCaption(mode.onBlockLot)} />
      </div>
      <Link href="#catalog" className={viewLotsCtaClassName}>
        View lots
      </Link>
    </MarketingStickyBidBar>
  );
}
