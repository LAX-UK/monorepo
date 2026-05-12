"use client";

import { LotCardTimer } from "@/components/lot-timer";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { MediaImage } from "@/components/ui/media-image";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
import { lotPath } from "@/lib/seo/url";
import { BulkActionBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { DataTable } from "@auction/ui/components/data-table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { WatchlistBoardRow } from "./watchlist-board-rows";

export type { WatchlistBoardRow } from "./watchlist-board-rows";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
}

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
          <LotCardTimer
            status={row.original.status}
            startTime={row.original.startTime}
            endTime={row.original.endTime}
          />
        ) : (
          <span className="text-on-surface-variant">\u2014</span>
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

function filterRows(rows: WatchlistBoardRow[], q: string): WatchlistBoardRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => r.title.toLowerCase().includes(t));
}

export function WatchlistBoard({
  rows,
  artistNameById = {},
  initialQ = "",
}: {
  rows: WatchlistBoardRow[];
  artistNameById?: Record<string, string>;
  initialQ?: string;
}) {
  const router = useRouter();
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const searchForm = useForm<{ q: string }>({
    resolver: zodResolver(urlTitleSearchSchema),
    defaultValues: { q: initialQ },
  });

  const filtered = useMemo(() => filterRows(rows, searchForm.watch("q") ?? ""), [rows, searchForm]);

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
        selectedIds.map((lotId) =>
          fetch(`${apiBase()}/users/me/watchlist/${encodeURIComponent(lotId)}`, {
            method: "DELETE",
            credentials: "include",
          }),
        ),
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

  return (
    <div className="space-y-4">
      <Form {...searchForm}>
        <form
          className="flex flex-col gap-3 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm sm:flex-row sm:items-end"
          onSubmit={(e) => e.preventDefault()}
        >
          <FormField
            control={searchForm.control}
            name="q"
            render={({ field }) => (
              <FormItem className="flex-1 space-y-2">
                <FormLabel
                  htmlFor="watchlist-q"
                  className="font-label text-xs uppercase tracking-widest text-secondary"
                >
                  Filter by lot title
                </FormLabel>
                <FormControl>
                  <Input
                    id="watchlist-q"
                    placeholder="e.g. oil on canvas"
                    className="max-w-md bg-surface-container-low"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <BulkActionBar count={selectedIds.length}>
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

      <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
        <DataTable
          columns={columns}
          data={filtered}
          emptyMessage="No watched lots match your filter."
          density="compact"
          enableRowSelection
          getRowId={(row) => row.lotId}
          rowSelection={selection}
          onRowSelectionChange={setSelection}
        />
      </div>
    </div>
  );
}
