"use client";

import { Button } from "@/components/ui/button";
import { TableScroll } from "@/components/ui/table-scroll";
import { formatMoney } from "@/lib/format-currency";
import { urlTitleSearchSchema } from "@/lib/forms/schemas/url-search";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import { Toolbar } from "@auction/ui/components/toolbar";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
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

function bidColumns(): ColumnDef<BidBoardRow>[] {
  return [
    {
      id: "thumb",
      header: "",
      cell: ({ row }) => {
        const img = row.original.lot?.images[0];
        const a = row.original.lot;
        return (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-surface-container-high">
            {img && a ? (
              <Image
                src={img}
                alt={`${a.title} — thumbnail`}
                fill
                className={`object-cover ${row.original.outbid ? "grayscale" : ""}`}
                sizes="56px"
              />
            ) : null}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: "lot",
      header: "Lot",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (!a) return <span className="text-secondary">Removed lot</span>;
        return (
          <Link
            href={`/artwork/${a.id}`}
            className="font-headline text-sm font-semibold text-on-surface underline-offset-4 hover:underline"
          >
            {a.title}
          </Link>
        );
      },
    },
    {
      id: "yourBid",
      header: "Your bid",
      accessorFn: (r) => r.bid.amount,
      cell: ({ row }) => (
        <span className={row.original.outbid ? "line-through tabular-nums" : "tabular-nums"}>
          {formatMoney(row.original.bid.amount)}
        </span>
      ),
    },
    {
      id: "current",
      header: "Current",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (!a) return "—";
        return <span className="tabular-nums">{formatMoney(a.currentPrice)}</span>;
      },
    },
    {
      id: "time",
      header: "Time",
      cell: ({ row }) => row.original.timeLeft,
    },
    {
      id: "status",
      header: "Status",
      accessorFn: (r) => r.statusLabel,
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-[0.14em] ${row.original.statusClassName}`}
        >
          {row.original.statusLabel}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const a = row.original.lot;
        if (a?.status !== "active") return null;
        return (
          <Button variant="primary" asChild>
            <Link href={`/artwork/${a.id}`}>Re-bid</Link>
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
    <TableScroll>
      <DataTable columns={columns} data={rows} />
    </TableScroll>
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

  const onTabChange = useCallback(
    (v: string) => {
      const nextTab = parseBidTab(v, "active");
      replaceQuery((p) => {
        if (nextTab === "active") p.delete("tab");
        else p.set("tab", nextTab);
      });
    },
    [replaceQuery],
  );

  return (
    <div className="w-full">
      <PageHeader
        title="Bids"
        description="Track active, won, and lost lots with your latest bid values."
        className="mb-6 border-b border-outline-variant/20 pb-5"
      />

      {fetchError ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not load bids</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      <Toolbar
        className="mb-5 rounded-sm border border-outline-variant/20 bg-white p-4"
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
                        className="bg-surface-container-low"
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

      <Tabs value={tab} onValueChange={onTabChange} className="w-full">
        <TabsList className="mb-5 grid w-full max-w-xs grid-cols-3 rounded-none border border-outline-variant/25 bg-transparent p-0">
          <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
          <TabsTrigger value="won">Won ({won.length})</TabsTrigger>
          <TabsTrigger value="lost">Lost ({lost.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          {active.length === 0 ? (
            <EmptyState
              title={fetchError ? "Unable to load" : "No active bids"}
              description={
                fetchError
                  ? "Try again later."
                  : "Browse live auctions and place your first bid on a lot you love."
              }
              action={
                !fetchError ? (
                  <Button variant="primary" asChild>
                    <Link href="/">Browse auctions</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : filteredActive.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Nothing in this tab matches your search. Clear the filter or try another title."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    searchForm.setValue("q", "");
                    replaceQuery((p) => {
                      p.delete("q");
                      if (tab !== "active") p.set("tab", tab);
                    });
                  }}
                >
                  Clear search
                </Button>
              }
            />
          ) : (
            <BoardTable rows={filteredActive} />
          )}
        </TabsContent>
        <TabsContent value="won">
          {won.length === 0 ? (
            <EmptyState
              title="No wins yet"
              description="When you win a lot, it will appear here."
            />
          ) : filteredWon.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Nothing in this tab matches your search."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    searchForm.setValue("q", "");
                    replaceQuery((p) => {
                      p.delete("q");
                      p.set("tab", "won");
                    });
                  }}
                >
                  Clear search
                </Button>
              }
            />
          ) : (
            <BoardTable rows={filteredWon} />
          )}
        </TabsContent>
        <TabsContent value="lost">
          {lost.length === 0 ? (
            <EmptyState
              title="No closed losses"
              description="Lots you did not win will show here."
            />
          ) : filteredLost.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Nothing in this tab matches your search."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    searchForm.setValue("q", "");
                    replaceQuery((p) => {
                      p.delete("q");
                      p.set("tab", "lost");
                    });
                  }}
                >
                  Clear search
                </Button>
              }
            />
          ) : (
            <BoardTable rows={filteredLost} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
