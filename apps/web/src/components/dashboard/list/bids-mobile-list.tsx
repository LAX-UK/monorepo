"use client";

import type { BidBoardRow } from "@/components/dashboard/bid-board-rows";
import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Surface } from "@auction/ui/components/surface";
import { History } from "lucide-react";
import Link from "next/link";

function lotArtistLabel(row: BidBoardRow, artistNameById: Record<string, string>): string {
  const id = row.lot?.artistId;
  if (id && artistNameById[id]) return artistNameById[id];
  return "Unattributed";
}

function statusVariant(row: BidBoardRow) {
  if (row.statusLabel === "Winning" || row.statusLabel === "Won") return "success";
  if (row.statusLabel === "Outbid") return "danger";
  if (row.lot?.status === "active") return "live";
  return "neutral";
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
                <p className="mt-1 text-sm tabular-nums">{formatMoney(row.bid.amount)}</p>
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
                  <StatusBadge variant={statusVariant(row)} size="sm">
                    {row.statusLabel}
                  </StatusBadge>
                  <span
                    className={
                      row.outbid
                        ? "text-sm tabular-nums line-through text-on-surface-variant"
                        : "text-sm font-semibold tabular-nums text-on-surface"
                    }
                  >
                    {formatMoney(row.bid.amount)}
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
                    onClick={() => onOpenHistory(lot.id, lot.title)}
                  >
                    <History className="mr-1 size-4" aria-hidden />
                    History
                  </Button>
                  {row.statusLabel === "Won" ? (
                    <Button variant="primary" size="sm" asChild>
                      <Link href={`/dashboard/checkout/${lot.id}`}>Settle now</Link>
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
