"use client";

import { ConnectionStatusBannerContainer } from "@/components/realtime/connection-status-banner-container";
import { BidEntryRegion } from "@/components/sections/artwork/online/bid-entry-region";
import { useBidPanelContext } from "@/components/sections/artwork/online/bid-panel-context";
import { lotBidPositionStickyLabel } from "@/lib/bid/derive-lot-bid-position";
import { formatMoney } from "@/lib/format-currency";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

export function VideoCompactBidPanel() {
  const {
    decision,
    connectivityScope,
    biddingLive,
    currentPrice,
    priceFlash,
    position,
    reserveContext,
    panel,
  } = useBidPanelContext();

  const { connectionBlocked, englishOnlySurfaceLock, step, switchEntryMode, minNumeric } = panel;

  const [compactExpanded, setCompactExpanded] = useState(false);

  const positionLabel = lotBidPositionStickyLabel(position, reserveContext);
  const canBid = decision.kind !== "block" && !connectionBlocked && !englishOnlySurfaceLock;

  return (
    <div className="min-w-0">
      {biddingLive ? (
        <ConnectionStatusBannerContainer scope={connectivityScope} className="mb-3" />
      ) : null}
      <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-label text-[0.65rem] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
              Current bid
            </p>
            <p
              className={`font-headline text-xl tabular-nums text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
            >
              {formatMoney(currentPrice)}
            </p>
            <p className="mt-0.5 font-label text-[0.65rem] text-secondary">
              Min next {formatMoney(minNumeric.toFixed(2))}
              {positionLabel ? (
                <span className="ml-2 font-bold uppercase tracking-wider text-primary">
                  · {positionLabel}
                </span>
              ) : null}
            </p>
          </div>

          {!compactExpanded ? (
            <Button
              type="button"
              aria-expanded={false}
              disabled={!canBid && decision.kind === "allow"}
              onClick={() => {
                if (decision.kind === "block") {
                  setCompactExpanded(true);
                } else if (canBid) {
                  switchEntryMode("manual", { userInitiated: true });
                  setCompactExpanded(true);
                }
              }}
              className="shrink-0 rounded-sm bg-cta-bg px-5 py-2.5 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm hover:bg-cta-bg/90"
            >
              {step === 2 ? "Confirm bid" : "Bid"}
            </Button>
          ) : (
            <Button
              type="button"
              aria-expanded={true}
              variant="ghost"
              onClick={() => setCompactExpanded(false)}
              className="shrink-0 px-3 py-2 font-label text-xs text-on-surface-variant"
            >
              Close
            </Button>
          )}
        </div>

        {compactExpanded ? (
          <div className="mt-4 border-t border-outline-variant/20 pt-4">
            <BidEntryRegion />
          </div>
        ) : null}
      </div>
    </div>
  );
}
