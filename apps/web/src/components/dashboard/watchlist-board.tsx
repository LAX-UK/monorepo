"use client";

import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { WatchlistMobileList } from "@/components/dashboard/list/watchlist-mobile-list";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { DashboardDesktopList } from "@/components/dashboard/primitives/dashboard-list-row-card";
import { DashboardLotCountdown } from "@/components/dashboard/primitives/dashboard-lot-countdown";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { MediaImage } from "@/components/ui/media-image";
import { removeWatchlistLot } from "@/lib/data/http/watchlist.client";
import { lotPath } from "@/lib/seo/url";
import { BulkActionBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DataTable } from "@auction/ui/components/data-table";
import { StatusBadge } from "@auction/ui/components/status-badge";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { WatchlistBoardRow } from "./watchlist-board-rows";

export type { WatchlistBoardRow } from "./watchlist-board-rows";

function watchlistColumns(artistNameById: Record<string, string>): ColumnDef<WatchlistBoardRow>[] {
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
      accessorFn: (row) =>
        (row.artistLabel && artistNameById[row.artistLabel]) || row.artistLabel || "",
      cell: ({ row }) => {
        const id = row.original.artistLabel;
        const display = (id && artistNameById[id]) || "Unattributed";
        return <span className="text-on-surface-variant">{display}</span>;
      },
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
          <DashboardLotCountdown
            status={row.original.status}
            startTime={row.original.startTime}
            endTime={row.original.endTime}
          />
        ) : (
          <span className="text-on-surface-variant">{"—"}</span>
        ),
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <ArtworkWatchToggle
          lotId={row.original.lotId}
          initialWatching
          isAuthenticated
          loginNextPath={lotPath({ id: row.original.lotId, title: row.original.title })}
        />
      ),
      enableSorting: false,
    },
  ];
}

function filterRows(rows: WatchlistBoardRow[], q: string): WatchlistBoardRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => r.title.toLowerCase().includes(t));
}

export function WatchlistBoard({
  rows,
  artistNameById = {},
  initialQ = "",
  clearSearchHref,
}: {
  rows: WatchlistBoardRow[];
  artistNameById?: Record<string, string>;
  initialQ?: string;
  /** Clears client title search only — preserves server-side status/category/sort filters. */
  clearSearchHref?: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = useMemo(() => filterRows(rows, initialQ), [rows, initialQ]);
  // Board handles client-side title search only; page handles server-filtered empty states.
  const hasTitleFilter = initialQ.trim().length > 0;

  useEffect(() => {
    const visible = new Set(filtered.map((row) => row.lotId));
    setSelection((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key] && !visible.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [filtered]);

  const columns = useMemo(() => watchlistColumns(artistNameById), [artistNameById]);

  const selectedIds = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, v]) => v)
        .map(([key]) => key),
    [selection],
  );

  const bulkRemove = useCallback(async () => {
    if (selectedIds.length === 0 || removing) return;
    setRemoving(true);
    setErrorMessage(null);
    try {
      const results = await Promise.allSettled(
        selectedIds.map((lotId) => removeWatchlistLot(lotId).then((ok) => ({ ok }))),
      );
      const failed = results.filter(
        (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
      );
      if (failed.length > 0) {
        setErrorMessage(
          `Removed ${selectedIds.length - failed.length} of ${selectedIds.length} lots. Please retry the rest.`,
        );
      }
      setSelection({});
      router.refresh();
    } finally {
      setRemoving(false);
    }
  }, [removing, router, selectedIds]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleRowSelection = useCallback((lotId: string, checked: boolean) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (checked) next[lotId] = true;
      else delete next[lotId];
      return next;
    });
  }, []);

  const emptyState = hasTitleFilter ? (
    <FilterEmptyState
      segment="dashboard"
      entity="watched lots"
      title="No title matches"
      description="Nothing in your current watchlist matches that phrase. Try another search or clear the title filter."
      {...(clearSearchHref ? { clearFiltersHref: clearSearchHref } : {})}
      browseHref="/search"
      browseLabel="Browse catalogue"
    />
  ) : (
    <DashboardEmptyState
      context="noResults"
      title="No watched lots"
      description="There is nothing to show in this view yet."
      action={
        <Button variant="ghost" size="sm" asChild>
          <Link href="/search">Browse catalogue</Link>
        </Button>
      }
    />
  );

  return (
    <div className="space-y-4">
      <DashboardFilterResultsAnnouncer count={filtered.length} entityLabel="lots" />

      <BulkActionBar count={selectedIds.length} offsetBottomChrome>
        <Button
          variant="destructive"
          size="sm"
          disabled={removing}
          onClick={() => void bulkRemove()}
          type="button"
        >
          <Trash2 className="size-4" aria-hidden />
          {removing ? "Removing\u2026" : "Remove selected"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setSelection({})}
          disabled={removing}
        >
          Clear selection
        </Button>
      </BulkActionBar>

      {errorMessage ? (
        <p role="alert" className="text-sm text-error">
          {errorMessage}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        emptyState
      ) : (
        <>
          <WatchlistMobileList
            rows={filtered}
            artistNameById={artistNameById}
            selectedIds={selectedIdSet}
            onToggleRow={toggleRowSelection}
          />
          <DashboardDesktopList>
            <DataTable
              columns={columns}
              data={filtered}
              density="compact"
              enableRowSelection
              getRowId={(row) => row.lotId}
              rowSelection={selection}
              onRowSelectionChange={setSelection}
            />
          </DashboardDesktopList>
        </>
      )}
    </div>
  );
}
