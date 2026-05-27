"use client";

import { BidHistoryDrawer } from "@/components/dashboard/bid-history-drawer";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardToolbar } from "@/components/dashboard/primitives/dashboard-toolbar";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { LotStatusTimer } from "@/components/marketing/lot-status-badge";
import { MediaImage } from "@/components/ui/media-image";
import { DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { DashboardSliceFailure } from "@/lib/dashboard/dashboard-fetch-errors";
import { formatMoney } from "@/lib/format-currency";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
import { lotPath } from "@/lib/seo/url";
import { Button } from "@auction/ui/components/button";
import { Button as UiButton } from "@auction/ui/components/button";
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
import type { ColumnDef } from "@tanstack/react-table";
import { Download, History } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { type BidBoardRow, type BidTab, parseBidTab } from "./bid-board-rows";

function filterBidRows(rows: BidBoardRow[], q: string): BidBoardRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => {
    const title = r.lot?.title.toLowerCase() ?? "";
    return title.includes(t);
  });
}

function tabHref(pathname: string, tab: BidTab, q: string) {
  const params = new URLSearchParams();
  if (tab !== "active") params.set("tab", tab);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function statusVariant(row: BidBoardRow) {
  if (row.statusLabel === "Winning" || row.statusLabel === "Won") return "success";
  if (row.statusLabel === "Outbid") return "danger";
  if (row.lot?.status === "active") return "live";
  return "neutral";
}

function lotArtistLabel(row: BidBoardRow, artistNameById: Record<string, string>): string {
  const id = row.lot?.artistId;
  if (id && artistNameById[id]) return artistNameById[id];
  return "Unattributed";
}

type BidColumnContext = {
  artistNameById: Record<string, string>;
  onOpenHistory: (lotId: string, title: string) => void;
};

function bidColumns(ctx: BidColumnContext): ColumnDef<BidBoardRow>[] {
  return [
    {
      id: "lot",
      header: "Lot",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (!a) return <span className="text-secondary">Removed lot</span>;
        const img = a.images[0];
        return (
          <Link href={lotPath(a)} className="flex min-w-[220px] items-center gap-3">
            <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
              <MediaImage
                src={img}
                alt={`${a.title} thumbnail`}
                label="Lot artwork"
                imgClassName={row.original.outbid ? "grayscale" : undefined}
                sizes="56px"
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline">
                {a.title}
              </span>
              {a.medium ? (
                <span className="block truncate text-xs text-on-surface-variant">{a.medium}</span>
              ) : null}
            </span>
          </Link>
        );
      },
      enableSorting: false,
    },
    {
      id: "artist",
      header: "Artist",
      accessorFn: (r) => lotArtistLabel(r, ctx.artistNameById),
      cell: ({ row }) => (
        <span className="text-on-surface-variant">
          {lotArtistLabel(row.original, ctx.artistNameById)}
        </span>
      ),
    },
    {
      id: "lotNumber",
      header: "Lot #",
      cell: ({ row }) => {
        const lotNumber = row.original.lot?.lotNumber;
        return lotNumber ? <span className="tabular-nums">{lotNumber}</span> : "—";
      },
    },
    {
      id: "yourBid",
      header: "My bid",
      accessorFn: (r) => r.bid.amount,
      cell: ({ row }) => (
        <span className={row.original.outbid ? "line-through tabular-nums" : "tabular-nums"}>
          {formatMoney(row.original.bid.amount)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.statusLabel,
      cell: ({ row }) => (
        <StatusBadge variant={statusVariant(row.original)} size="sm">
          {row.original.statusLabel}
        </StatusBadge>
      ),
    },
    {
      id: "timer",
      header: "Timer",
      cell: ({ row }) => {
        const lot = row.original.lot;
        if (!lot || lot.status !== "active")
          return <span className="text-on-surface-variant">—</span>;
        return (
          <LotStatusTimer
            status={lot.status}
            startTime={lot.startTime.toISOString()}
            endTime={lot.endTime.toISOString()}
          />
        );
      },
      enableSorting: false,
    },
    {
      id: "history",
      header: "",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (!a) return null;
        return (
          <UiButton
            variant="ghost"
            size="sm"
            type="button"
            aria-label={`View bid history for ${a.title}`}
            onClick={() => ctx.onOpenHistory(a.id, a.title)}
          >
            <History className="size-4" aria-hidden />
            <span className="ml-1 hidden sm:inline">History</span>
          </UiButton>
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (!a) return null;
        if (row.original.statusLabel === "Won") {
          return (
            <Button variant="primary" asChild>
              <Link href={`/dashboard/checkout/${a.id}`}>Settle now</Link>
            </Button>
          );
        }
        if (a.status !== "active") return null;
        return (
          <Button variant="primary" asChild>
            <Link href={lotPath(a)}>Re-bid</Link>
          </Button>
        );
      },
      enableSorting: false,
    },
  ];
}

function BoardTable({
  rows,
  artistNameById,
  onOpenHistory,
}: {
  rows: BidBoardRow[];
  artistNameById: Record<string, string>;
  onOpenHistory: (lotId: string, title: string) => void;
}) {
  const columns = useMemo(
    () => bidColumns({ artistNameById, onOpenHistory }),
    [artistNameById, onOpenHistory],
  );
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm">
      <DataTable columns={columns} data={rows} density="compact" />
    </div>
  );
}

function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function exportRowsToCsv(rows: BidBoardRow[], artistNameById: Record<string, string>): string {
  const header = [
    "lot_id",
    "lot_number",
    "title",
    "artist",
    "medium",
    "status",
    "my_bid",
    "current_price",
    "ended_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const a = r.lot;
    const cells = [
      a?.id ?? "",
      a?.lotNumber != null ? String(a.lotNumber) : "",
      a?.title ?? "",
      a?.artistId ? (artistNameById[a.artistId] ?? "Unattributed") : "Unattributed",
      a?.medium ?? "",
      r.statusLabel,
      r.bid.amount,
      a?.currentPrice ?? "",
      a?.endTime.toISOString() ?? "",
    ].map((v) => csvCell(String(v)));
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}

function triggerCsvDownload(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function BidsBoard({
  loadFailure,
  sessionFailure = null,
  active,
  won,
  lost,
  initialTab,
  initialQ,
  artistNameById = {},
}: {
  loadFailure: DashboardSliceFailure | null;
  sessionFailure?: DashboardSliceFailure | null;
  active: BidBoardRow[];
  won: BidBoardRow[];
  lost: BidBoardRow[];
  initialTab: BidTab;
  initialQ: string;
  artistNameById?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchForm = useForm<{ q: string }>({
    resolver: zodResolver(urlTitleSearchSchema),
    defaultValues: { q: initialQ },
  });
  useEffect(() => {
    searchForm.reset({ q: initialQ });
  }, [initialQ, searchForm]);

  const tab = parseBidTab(searchParams.get("tab"), initialTab);
  const appliedQ = (searchParams.get("q") ?? "").trim().slice(0, 200);

  const filteredActive = useMemo(() => filterBidRows(active, appliedQ), [active, appliedQ]);
  const filteredWon = useMemo(() => filterBidRows(won, appliedQ), [won, appliedQ]);
  const filteredLost = useMemo(() => filterBidRows(lost, appliedQ), [lost, appliedQ]);

  const [history, setHistory] = useState<{ lotId: string; title: string } | null>(null);
  const openHistory = useCallback((lotId: string, title: string) => {
    setHistory({ lotId, title });
  }, []);

  const replaceQuery = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const applySearch = useCallback(
    (q: string) => {
      replaceQuery((p) => {
        const trimmed = q.trim().slice(0, 200);
        if (trimmed) p.set("q", trimmed);
        else p.delete("q");
        if (tab !== "active") p.set("tab", tab);
        else p.delete("tab");
      });
    },
    [replaceQuery, tab],
  );

  const currentRows =
    tab === "won"
      ? { all: won, filtered: filteredWon }
      : tab === "lost"
        ? { all: lost, filtered: filteredLost }
        : { all: active, filtered: filteredActive };

  const clearSearch = useCallback(
    (nextTab: BidTab = tab) => {
      searchForm.setValue("q", "");
      replaceQuery((p) => {
        p.delete("q");
        if (nextTab === "active") p.delete("tab");
        else p.set("tab", nextTab);
      });
    },
    [replaceQuery, searchForm, tab],
  );

  const exportCurrentTab = useCallback(() => {
    const rows = tab === "won" ? filteredWon : tab === "lost" ? filteredLost : filteredActive;
    if (rows.length === 0) return;
    const filename = `lax-bids-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    triggerCsvDownload(filename, exportRowsToCsv(rows, artistNameById));
  }, [tab, filteredActive, filteredWon, filteredLost, artistNameById]);

  const currentTabHasRows =
    (tab === "won"
      ? filteredWon.length
      : tab === "lost"
        ? filteredLost.length
        : filteredActive.length) > 0;

  return (
    <div className="min-w-0 max-w-[var(--container-inner,1376px)]">
      <DashboardPageHeader
        meta="Bidding"
        title="My Bids"
        description="Track active, won, and lost lots with your latest bid values."
        actions={
          <Button
            type="button"
            variant="secondaryOutline"
            onClick={exportCurrentTab}
            disabled={!currentTabHasRows}
            aria-label="Download current tab as CSV"
          >
            <Download className="mr-1 size-4" aria-hidden />
            Export CSV
          </Button>
        }
      />

      {sessionFailure ? <DashboardSliceErrorAlert failure={sessionFailure} /> : null}
      {loadFailure ? <DashboardSliceErrorAlert failure={loadFailure} /> : null}

      {!loadFailure ? (
        <>
          <SectionTabsNav
            ariaLabel="Bid status"
            className="mb-5 rounded-xl border border-border-hairline bg-surface-container-lowest px-3"
            items={[
              {
                href: tabHref(pathname, "active", appliedQ),
                label: "Active",
                badge: active.length,
                isActive: tab === "active",
              },
              {
                href: tabHref(pathname, "won", appliedQ),
                label: "Won",
                badge: won.length,
                isActive: tab === "won",
              },
              {
                href: tabHref(pathname, "lost", appliedQ),
                label: "Lost",
                badge: lost.length,
                isActive: tab === "lost",
              },
            ]}
          />

          <DashboardToolbar
            search={
              <Form {...searchForm}>
                <form
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                  onSubmit={searchForm.handleSubmit((v) => {
                    applySearch(v.q);
                  })}
                >
                  <FormField
                    control={searchForm.control}
                    name="q"
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1 space-y-2">
                        <FormLabel
                          htmlFor="bids-q"
                          className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
                        >
                          Filter by lot title
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="bids-q"
                            placeholder="e.g. oil on canvas"
                            className="max-w-md bg-surface-container-low"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" variant="secondaryOutline">
                    Apply
                  </Button>
                </form>
              </Form>
            }
            filters={
              <p className="font-body text-xs text-on-surface-variant">
                Latest bid per lot · URL shares <span className="font-mono">tab</span> and{" "}
                <span className="font-mono">q</span>
              </p>
            }
          />

          {currentRows.all.length === 0 ? (
            <DashboardEmptyState
              title={
                tab === "active"
                  ? DASHBOARD_EMPTY.bids.title
                  : tab === "won"
                    ? "No wins yet"
                    : "No closed losses"
              }
              description={
                tab === "active"
                  ? DASHBOARD_EMPTY.bids.description
                  : tab === "won"
                    ? "When you win a lot, it will appear here."
                    : "Lots you did not win will show here."
              }
              action={
                tab === "active" ? (
                  <Button variant="primary" asChild>
                    <Link href="/search">{DASHBOARD_CTA.browseLiveAuctions}</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : currentRows.filtered.length === 0 ? (
            <DashboardEmptyState
              title="No matches"
              description="Nothing in this tab matches your search. Clear the filter or try another title."
              action={
                <Button type="button" variant="secondaryOutline" onClick={() => clearSearch(tab)}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <BoardTable
              rows={currentRows.filtered}
              artistNameById={artistNameById}
              onOpenHistory={openHistory}
            />
          )}

          <BidHistoryDrawer
            open={history != null}
            lotId={history?.lotId ?? null}
            lotTitle={history?.title ?? ""}
            onOpenChange={(o) => {
              if (!o) setHistory(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
