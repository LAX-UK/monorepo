"use client";

import { DashboardSectionTabs } from "@/components/dashboard/dashboard-section-tabs";
import { LotCardTimer } from "@/components/lot-timer";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/media-image";
import { formatMoney } from "@/lib/format-currency";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
import { lotPath } from "@/lib/seo/url";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { DataTable } from "@auction/ui/components/data-table";
import { EmptyState } from "@auction/ui/components/empty-state";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { Input } from "@auction/ui/components/input";
import { PageHeader } from "@auction/ui/components/page-header";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { Toolbar } from "@auction/ui/components/toolbar";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
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

function lotArtistLabel(row: BidBoardRow): string {
  return row.lot?.artistId ?? row.lot?.sellerId ?? "—";
}

function bidColumns(): ColumnDef<BidBoardRow>[] {
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
      cell: ({ row }) => (
        <span className="text-on-surface-variant">{lotArtistLabel(row.original)}</span>
      ),
      enableSorting: false,
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
          <LotCardTimer
            status={lot.status}
            startTime={lot.startTime.toISOString()}
            endTime={lot.endTime.toISOString()}
          />
        );
      },
      enableSorting: false,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (a?.status !== "active") return null;
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

function BoardTable({ rows }: { rows: BidBoardRow[] }) {
  const columns = useMemo(() => bidColumns(), []);
  if (rows.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
      <DataTable columns={columns} data={rows} density="compact" />
    </div>
  );
}

export function BidsBoard({
  fetchError,
  active,
  won,
  lost,
  initialTab,
  initialQ,
}: {
  fetchError: string | null;
  active: BidBoardRow[];
  won: BidBoardRow[];
  lost: BidBoardRow[];
  initialTab: BidTab;
  initialQ: string;
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

  return (
    <div className="min-w-0 max-w-[var(--container-inner,1376px)]">
      <PageHeader
        title="My Bids"
        description="Track active, won, and lost lots with your latest bid values."
        className="border-0 pb-0"
      />

      {fetchError ? (
        <Alert variant="destructive" className="mb-8 rounded-xl border-error/40 shadow-sm">
          <AlertTitle>Could not load bids</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      <DashboardSectionTabs
        ariaLabel="Bid status"
        className="mb-5 rounded-xl border border-outline-variant/15 bg-surface-container-lowest px-3"
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

      <Toolbar
        className="mb-5 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm"
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
                      className="font-label text-xs uppercase tracking-widest text-secondary"
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
              <Button type="submit" variant="secondary">
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
        <EmptyState
          title={
            tab === "active"
              ? fetchError
                ? "Unable to load"
                : "No active bids"
              : tab === "won"
                ? "No wins yet"
                : "No closed losses"
          }
          description={
            fetchError
              ? "Try again later."
              : tab === "active"
                ? "Browse live auctions and place your first bid on a lot you love."
                : tab === "won"
                  ? "When you win a lot, it will appear here."
                  : "Lots you did not win will show here."
          }
          action={
            tab === "active" && !fetchError ? (
              <Button variant="primary" asChild>
                <Link href="/">Browse auctions</Link>
              </Button>
            ) : undefined
          }
        />
      ) : currentRows.filtered.length === 0 ? (
        <EmptyState
          title="No matches"
          description="Nothing in this tab matches your search. Clear the filter or try another title."
          action={
            <Button type="button" variant="secondary" onClick={() => clearSearch(tab)}>
              Clear search
            </Button>
          }
        />
      ) : (
        <BoardTable rows={currentRows.filtered} />
      )}
    </div>
  );
}
