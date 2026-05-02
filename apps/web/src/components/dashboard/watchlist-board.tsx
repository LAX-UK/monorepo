"use client";

import { LotCardTimer } from "@/components/lot-timer";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { ImagePlaceholder } from "@/components/ui/image-placeholder";
import { formatMoney } from "@/lib/format-currency";
import type { LotStatus } from "@auction/types";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

export type WatchlistBoardRow = {
  watchlistId: string;
  lotId: string;
  title: string;
  image: string | null;
  medium: string | null;
  lotNumber: number | null;
  estimateLabel: string;
  status: LotStatus;
  startTime: string;
  endTime: string;
};

function watchlistColumns(): ColumnDef<WatchlistBoardRow>[] {
  return [
    {
      id: "lot",
      header: "Lot",
      cell: ({ row }) => (
        <Link
          href={`/artwork/${row.original.lotId}`}
          className="flex min-w-[240px] items-center gap-3"
        >
          <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
            {row.original.image ? (
              <Image
                src={row.original.image}
                alt={`${row.original.title} thumbnail`}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <ImagePlaceholder label="Lot artwork" hideIcon />
            )}
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
      cell: () => <span className="text-on-surface-variant">—</span>,
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

export function estimateLabel(row: {
  estimate: { low: string; high: string; currency: string } | undefined;
  fallback: string;
}) {
  if (!row.estimate) return formatMoney(row.fallback);
  return `${row.estimate.currency} ${row.estimate.low} – ${row.estimate.high}`;
}
