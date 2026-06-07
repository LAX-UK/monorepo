"use client";

import { DashboardMobileLotThumbnail } from "@/components/dashboard/list/dashboard-mobile-lot-thumbnail";
import {
  DashboardListRowCard,
  DashboardMobileList,
} from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import type { WatchlistBoardRow } from "@/components/dashboard/watchlist-board-rows";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { useDashboardListRowPaddingClass } from "@/hooks/use-dashboard-list-density";
import { lotPath } from "@/lib/seo/url";
import { cn } from "@auction/ui";
import { Checkbox } from "@auction/ui/components/checkbox";
import { StatusBadge } from "@auction/ui/components/status-badge";
import Link from "next/link";

type Props = {
  rows: WatchlistBoardRow[];
  artistNameById: Record<string, string>;
  selectedIds: Set<string>;
  onToggleRow: (lotId: string, checked: boolean) => void;
};

export function WatchlistMobileList({ rows, artistNameById, selectedIds, onToggleRow }: Props) {
  const rowPadding = useDashboardListRowPaddingClass();
  return (
    <DashboardMobileList>
      {rows.map((row) => {
        const artist =
          (row.artistLabel && artistNameById[row.artistLabel]) || row.artistLabel || "Unattributed";
        const selected = selectedIds.has(row.lotId);
        return (
          <li key={row.lotId}>
            <DashboardListRowCard
              className={cn(
                "transition-colors",
                rowPadding,
                selected && "border-primary/40 bg-primary-container/5",
              )}
              leading={
                <Checkbox
                  checked={selected}
                  onCheckedChange={(checked) => onToggleRow(row.lotId, checked === true)}
                  aria-label={`Select ${row.title}`}
                  className="mt-1 shrink-0"
                />
              }
              thumbnail={
                <DashboardMobileLotThumbnail
                  href={lotPath({ id: row.lotId, title: row.title })}
                  src={row.image}
                  alt={`${row.title} thumbnail`}
                />
              }
              title={
                <Link
                  href={lotPath({ id: row.lotId, title: row.title })}
                  className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
                >
                  {row.title}
                </Link>
              }
              subtitle={<p className="truncate text-xs text-on-surface-variant">{artist}</p>}
              badges={
                <>
                  <StatusBadge variant={row.status === "active" ? "live" : "neutral"} size="sm">
                    {row.status}
                  </StatusBadge>
                  <span className="text-xs tabular-nums text-on-surface-variant">
                    {row.estimateLabel}
                  </span>
                </>
              }
              afterBadges={
                row.status === "active" || row.status === "scheduled" ? (
                  <div className="mt-1 text-xs text-on-surface-variant">
                    <DashboardLotCountdown
                      status={row.status}
                      startTime={row.startTime}
                      endTime={row.endTime}
                    />
                  </div>
                ) : null
              }
              footer={
                <span data-testid="watchlist-mobile-actions">
                  <ArtworkWatchToggle
                    lotId={row.lotId}
                    initialWatching
                    isAuthenticated
                    appearance="list-action"
                    lotTitle={row.title}
                    loginNextPath={lotPath({ id: row.lotId, title: row.title })}
                  />
                </span>
              }
              footerIndented
            />
          </li>
        );
      })}
    </DashboardMobileList>
  );
}
