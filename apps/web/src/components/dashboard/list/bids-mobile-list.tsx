"use client";

import type { BidBoardRow } from "@/components/dashboard/bid-board-rows";
import { BidPlacementBadge } from "@/components/dashboard/bid-placement-badge";
import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { bidBoardDotStatus } from "@/lib/presenters/status/bid-board-dot-status";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Surface } from "@auction/ui/components/surface";
import { History } from "lucide-react";
import Link from "next/link";

function lotArtistLabel(row: BidBoardRow, artistNameById: Record<string, string>): string {
  const id = row.lot?.artistId;
  if (id && artistNameById[id]) return artistNameById[id];
  return "Unattributed";
}

type Props = {
  rows: BidBoardRow[];
  artistNameById: Record<string, string>;
  onOpenHistory: (lotId: string, title: string) => void;
};

export function BidsMobileList({ rows, artistNameById, onOpenHistory }: Props) {
  const rowPadding = useDashboardListRowPaddingClass();
  return (
    <DashboardMobileList>
      {rows.map((row) => {
        const lot = row.lot;
        if (!lot) {
          return (
            <li key={row.bid.id}>
              <Surface variant="card" padding="md">
                <p className="text-sm text-on-surface-variant">Removed lot</p>
                <p className="mt-1 text-sm tabular-nums">
                  {formatMoney(row.bid.amount, PLATFORM_DEFAULT_CURRENCY)}
                </p>
              </Surface>
            </li>
          );
        }
        const img = lot.images[0];
        return (
          <li key={row.bid.id}>
            <DashboardListRowCard
              className={rowPadding}
              thumbnail={
                <DashboardMobileLotThumbnail
                  href={lotPath(lot)}
                  src={img}
                  alt={`${lot.title} thumbnail`}
                  {...(row.outbid ? { imgClassName: "grayscale" } : {})}
                />
              }
              title={
                <Link
                  href={lotPath(lot)}
                  className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
                >
                  {lot.title}
                </Link>
              }
              subtitle={
                <p className="truncate text-xs text-on-surface-variant">
                  {lotArtistLabel(row, artistNameById)}
                </p>
              }
              badges={
                <>
                  {(() => {
                    const presentation = bidBoardDotStatus({
                      statusLabel: row.statusLabel,
                      lotStatus: lot.status,
                    });
                    return <DotStatusPill label={presentation.label} tone={presentation.tone} />;
                  })()}
                  {row.placement.onBehalf ? <BidPlacementBadge bid={row.bid} /> : null}
                  <span
                    className={
                      row.outbid
                        ? "text-sm tabular-nums line-through text-on-surface-variant"
                        : "text-sm font-semibold tabular-nums text-on-surface"
                    }
                  >
                    {formatMoney(row.bid.amount, resolveLotCurrency(lot))}
                  </span>
                </>
              }
              afterBadges={
                lot.status === "active" || lot.status === "scheduled" ? (
                  <div className="mt-1 text-xs">
                    <DashboardLotCountdown
                      status={lot.status}
                      startTime={lot.startTime}
                      endTime={lot.endTime}
                    />
                  </div>
                ) : null
              }
              footer={
                <>
                  <Button
                    type="button"
                    variant="secondaryOutline"
                    size="sm"
                    aria-label={`View bid history for ${lot.title}`}
                    onClick={() => onOpenHistory(lot.id, lot.title)}
                  >
                    <History className="mr-1 size-4" aria-hidden />
                    History
                  </Button>
                  {row.statusLabel === "Won" ? (
                    <Button variant="primary" size="sm" asChild>
                      <Link href={dashboardCheckoutLotUrl(lot.id)}>Settle now</Link>
                    </Button>
                  ) : lot.status === "active" ? (
                    <Button variant="primary" size="sm" asChild>
                      <Link href={lotPath(lot)}>Re-bid</Link>
                    </Button>
                  ) : null}
                </>
              }
            />
          </li>
        );
      })}
    </DashboardMobileList>
  );
}
