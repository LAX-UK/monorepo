"use client";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format-currency";
import type { Bid, Lot } from "@auction/types";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { DataTable } from "@auction/ui/components/data-table";
import { EmptyState } from "@auction/ui/components/empty-state";
import { PageHeader } from "@auction/ui/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@auction/ui/components/tabs";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";

export type BidBoardRow = {
  bid: Bid;
  lot: Lot | null;
  statusLabel: string;
  statusClassName: string;
  outbid: boolean;
  timeLeft: string;
};

function formatRemaining(endMs: number, now: number): string {
  const ms = endMs - now;
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
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
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-container-high">
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
            className="font-headline text-sm text-on-surface underline-offset-4 hover:underline"
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
          className={`font-label text-[10px] font-bold uppercase tracking-widest ${row.original.statusClassName}`}
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
  return <DataTable columns={columns} data={rows} />;
}

export function BidsBoard({
  fetchError,
  active,
  won,
  lost,
}: {
  fetchError: string | null;
  active: BidBoardRow[];
  won: BidBoardRow[];
  lost: BidBoardRow[];
}) {
  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Active bids"
        description="Your latest bid per lot, sorted by closing time. Increase your offer in one click."
        className="mb-8 border-0 pb-0"
      />

      {fetchError ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not load bids</AlertTitle>
          <AlertDescription>{fetchError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="mb-6 grid w-full max-w-md grid-cols-3">
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
          ) : (
            <BoardTable rows={active} />
          )}
        </TabsContent>
        <TabsContent value="won">
          {won.length === 0 ? (
            <EmptyState
              title="No wins yet"
              description="When you win a lot, it will appear here."
            />
          ) : (
            <BoardTable rows={won} />
          )}
        </TabsContent>
        <TabsContent value="lost">
          {lost.length === 0 ? (
            <EmptyState
              title="No closed losses"
              description="Lots you did not win will show here."
            />
          ) : (
            <BoardTable rows={lost} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function buildBidBoardRows(
  unique: { bid: Bid; lot: Lot | null }[],
  userId: string | undefined,
  now: number,
): { active: BidBoardRow[]; won: BidBoardRow[]; lost: BidBoardRow[] } {
  const active: BidBoardRow[] = [];
  const won: BidBoardRow[] = [];
  const lost: BidBoardRow[] = [];

  for (const row of unique) {
    const a = row.lot;

    if (!a) {
      lost.push({
        bid: row.bid,
        lot: null,
        statusLabel: "Unknown",
        statusClassName: "text-secondary",
        outbid: false,
        timeLeft: "—",
      });
      continue;
    }

    if (a.status === "ended") {
      const didWin = Boolean(userId && a.winnerId === userId);
      if (didWin) {
        won.push({
          bid: row.bid,
          lot: a,
          statusLabel: "Won",
          statusClassName: "text-primary",
          outbid: false,
          timeLeft: "—",
        });
      } else {
        lost.push({
          bid: row.bid,
          lot: a,
          statusLabel: "Closed",
          statusClassName: "text-secondary",
          outbid: false,
          timeLeft: "—",
        });
      }
      continue;
    }

    if (a.status === "active") {
      const myAmount = Number.parseFloat(row.bid.amount);
      const high = Number.parseFloat(a.currentPrice);
      const winning = row.bid.isWinning && Math.abs(myAmount - high) < 0.02;
      const statusLabel = winning ? "Winning" : "Outbid";
      const statusClassName = winning ? "text-primary" : "text-error";
      const timeLeft = formatRemaining(a.endTime.getTime(), now);
      active.push({
        bid: row.bid,
        lot: a,
        statusLabel,
        statusClassName,
        outbid: !winning,
        timeLeft,
      });
      continue;
    }

    lost.push({
      bid: row.bid,
      lot: a,
      statusLabel: a.status,
      statusClassName: "text-secondary",
      outbid: false,
      timeLeft: "—",
    });
  }

  return { active, won, lost };
}
