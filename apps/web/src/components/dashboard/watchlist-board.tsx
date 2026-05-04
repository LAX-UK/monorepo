"use client";

import { LotCardTimer } from "@/components/lot-timer";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { MediaImage } from "@/components/ui/media-image";
import { lotPath } from "@/lib/seo/url";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import type { WatchlistBoardRow } from "./watchlist-board-rows";

export type { WatchlistBoardRow } from "./watchlist-board-rows";

function watchlistColumns(): ColumnDef<WatchlistBoardRow>[] {
  return [
    {
      id: "lot",
      header: "Lot",
      cell: ({ row }) => (
        <Link
          href={lotPath({ id: row.original.lotId, title: row.original.title })}
          className="flex min-w-[240px] items-center gap-3"
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
            <MediaImage
              src={row.original.image}
              alt={`${row.original.title} thumbnail`}
              label="Lot artwork"
              sizes="56px"
            />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline">
              {row.original.title}
            </span>
            {row.original.medium ? (
              <span className="block truncate text-xs text-on-surface-variant">
                {row.original.medium}
              </span>
            ) : null}
          </span>
        </Link>
      ),
      enableSorting: false,
    },
    {
      id: "artist",
      header: "Artist",
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{row.original.artistLabel}</span>
      ),
      enableSorting: false,
    },
    {
      id: "estimate",
      header: "Estimate",
      accessorFn: (row) => row.estimateLabel,
      cell: ({ row }) => <span className="tabular-nums">{row.original.estimateLabel}</span>,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (row) => row.status,
      cell: ({ row }) => (
        <StatusBadge variant={row.original.status === "active" ? "live" : "neutral"}>
          {row.original.status}
        </StatusBadge>
      ),
    },
    {
      id: "closes",
      header: "Closes",
      cell: ({ row }) =>
        row.original.status === "active" || row.original.status === "scheduled" ? (
          <LotCardTimer
            status={row.original.status}
            startTime={row.original.startTime}
            endTime={row.original.endTime}
          />
        ) : (
          <span className="text-on-surface-variant">—</span>
        ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ArtworkWatchToggle lotId={row.original.lotId} initialWatching isAuthenticated />
      ),
      enableSorting: false,
    },
  ];
}

export function WatchlistBoard({ rows }: { rows: WatchlistBoardRow[] }) {
  const columns = useMemo(() => watchlistColumns(), []);

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No watched lots yet."
      density="compact"
    />
  );
}
