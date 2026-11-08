"use client";

import { LotLifecycleStatusBadge } from "@/components/marketing/lot-lifecycle-status-badge";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { SaleroomSessionCaption } from "@/components/marketing/saleroom-session-caption";
import { SaleroomSessionStatusBadge } from "@/components/marketing/saleroom-session-status-badge";
import { saleroomOnBlockBadge } from "@/lib/lot/lot-lifecycle";
import {
  type SaleroomMobileSummaryBarMode,
  saleroomOnBlockCaption,
  saleroomPausedCaption,
} from "@/lib/saleroom/saleroom-mobile-chrome";
import { Button } from "@auction/ui/lax";
import Link from "next/link";

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
      <MarketingStickyBidBar>
        <div className="min-w-0 flex flex-col gap-1">
          <LotLifecycleStatusBadge badge={saleroomOnBlockBadge()} />
          <span className="sr-only">{saleTitle}</span>
          <SaleroomSessionCaption caption={saleroomOnBlockCaption(mode.lot, mode.progressLabel)} />
        </div>
        {canParticipate ? (
          <Button variant="primary" size="lg" asChild>
            <Link href={mode.lot.href}>Bid now</Link>
          </Button>
        ) : (
          <Button variant="secondary" size="lg" asChild>
            <Link href="#catalog">View lots</Link>
          </Button>
        )}
      </MarketingStickyBidBar>
    );
  }

  return (
    <MarketingStickyBidBar>
      <div className="min-w-0 flex flex-col gap-1">
        <SaleroomSessionStatusBadge status="paused" />
        <span className="sr-only">{saleTitle}</span>
        <SaleroomSessionCaption caption={saleroomPausedCaption(mode.onBlockLot)} />
      </div>
      <Button variant="secondary" size="lg" asChild>
        <Link href="#catalog">View lots</Link>
      </Button>
    </MarketingStickyBidBar>
  );
}
