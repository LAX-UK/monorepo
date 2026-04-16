"use client";

import { useAuctionRealtime } from "@/hooks/use-auction-realtime";
import { AuctionPortsProvider } from "@/lib/context/auction-ports";
import { formatCountdownClock } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import type { Auction, Bid } from "@auction/types";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

export type ActiveBidRow = {
  bid: Bid;
  auction: Auction;
};

function ActiveBidRowInner({ row, userId }: { row: ActiveBidRow; userId: string }) {
  const [endMs, setEndMs] = useState(() => new Date(row.auction.endTime).getTime());
  const [price, setPrice] = useState(row.auction.currentPrice);
  const [now, setNow] = useState(() => Date.now());
  const [isWinning, setIsWinning] = useState(row.bid.isWinning);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useAuctionRealtime(row.auction.id, {
    onBidUpdate: (e) => {
      setPrice(e.currentPrice);
      if (e.endTime) setEndMs(new Date(e.endTime).getTime());
      setIsWinning(e.bidderId === userId);
    },
    onAuctionEnded: (p) => {
      setEndMs(Date.now());
      setIsWinning(p.winnerId === userId);
    },
  });

  const live = row.auction.status === "active";
  const remaining = endMs - now;
  const countdown = formatCountdownClock(remaining);

  return (
    <li className="rounded-xl border border-outline-variant/15 bg-surface-container-low/80 p-4 ring-1 ring-outline-variant/10">
      <div className="flex gap-3">
        <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-surface-container-high">
          {row.auction.images[0] ? (
            <Image src={row.auction.images[0]} alt="" fill className="object-cover" sizes="64px" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/artwork/${row.auction.id}`}
            className="line-clamp-2 font-headline text-sm text-on-surface hover:text-primary"
          >
            {row.auction.title}
          </Link>
          <p className="mt-1 font-label text-[0.65rem] uppercase tracking-widest text-secondary">
            {live ? `Ends in ${countdown}` : "Closed"}
          </p>
          <p className="mt-1 font-body text-xs text-on-surface-variant">
            Your bid {formatMoney(row.bid.amount)} · Now {formatMoney(price)}
          </p>
          <p
            className={`mt-1 font-label text-[0.65rem] font-bold uppercase tracking-wider ${
              isWinning ? "text-primary" : "text-error"
            }`}
          >
            {isWinning ? "Winning" : "Outbid"}
          </p>
        </div>
        <Link
          href={`/artwork/${row.auction.id}`}
          className="self-center shrink-0 rounded-md bg-primary px-3 py-2 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-primary"
        >
          View
        </Link>
      </div>
    </li>
  );
}

function ActiveBidRowWithPorts({ row, userId }: { row: ActiveBidRow; userId: string }) {
  return (
    <AuctionPortsProvider>
      <ActiveBidRowInner row={row} userId={userId} />
    </AuctionPortsProvider>
  );
}

type Props = {
  rows: ActiveBidRow[];
  userId: string;
};

/** One realtime subscription per active lot (wrapped in its own provider tree). */
export function ActiveBidsWidget({ rows, userId }: Props) {
  const deduped = useMemo(() => {
    const byAuction = new Map<string, ActiveBidRow>();
    for (const r of rows) {
      if (r.auction.status !== "active") continue;
      const prev = byAuction.get(r.auction.id);
      if (!prev || new Date(r.bid.createdAt) > new Date(prev.bid.createdAt)) {
        byAuction.set(r.auction.id, r);
      }
    }
    return [...byAuction.values()].slice(0, 12);
  }, [rows]);

  if (deduped.length === 0) return null;

  return (
    <section className="mb-12 rounded-xl border border-outline-variant/15 bg-surface-container-low/50 p-8 shadow-sm ring-1 ring-outline-variant/10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-headline text-2xl text-on-surface">Active bids</h2>
        <span className="font-label text-xs uppercase tracking-widest text-secondary">
          Live countdowns
        </span>
      </div>
      <ul className="space-y-4">
        {deduped.map((row) => (
          <ActiveBidRowWithPorts key={row.auction.id} row={row} userId={userId} />
        ))}
      </ul>
    </section>
  );
}
