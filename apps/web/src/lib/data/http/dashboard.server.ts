import "server-only";
import { parseAuction, parseBid } from "@/lib/data/http/parse";
import type { Auction, Bid, PaymentStatus, PortfolioRow } from "@auction/types";
import { cookies } from "next/headers";
import { getServerApiBase } from "./hc-server";

export type BidWithAuction = {
  bid: Bid;
  auction: Auction | null;
};

async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

async function authedFetch(path: string): Promise<Response> {
  const cookie = await cookieHeader();
  const headers = new Headers();
  if (cookie) headers.set("Cookie", cookie);
  return fetch(`${getServerApiBase()}${path}`, {
    headers,
    credentials: "include",
  });
}

export async function getServerMyBids(): Promise<BidWithAuction[]> {
  const res = await authedFetch("/users/me/bids");
  if (!res.ok) {
    throw new Error(`Failed to load bids: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: Array<{ bid: unknown; auction: unknown | null }>;
  };
  return body.data.map((row) => ({
    bid: parseBid(row.bid),
    auction: row.auction ? parseAuction(row.auction) : null,
  }));
}

function isPaymentStatus(s: string): s is PaymentStatus {
  return s === "pending" || s === "authorized" || s === "captured" || s === "refunded";
}

export async function getServerMyPortfolio(): Promise<PortfolioRow[]> {
  const res = await authedFetch("/users/me/portfolio");
  if (!res.ok) {
    throw new Error(`Failed to load portfolio: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: Array<{ auction: unknown; payment: { id: string; status: string } | null }>;
  };
  return body.data.map((row) => ({
    auction: parseAuction(row.auction),
    payment:
      row.payment && isPaymentStatus(row.payment.status)
        ? { id: row.payment.id, status: row.payment.status }
        : null,
  }));
}

export type WatchlistWithAuctionRow = {
  watchlistId: string;
  auctionId: string;
  createdAt: Date;
  auction: Auction | null;
};

export async function getServerMyWatchlist(): Promise<WatchlistWithAuctionRow[]> {
  const res = await authedFetch("/users/me/watchlist");
  if (!res.ok) {
    throw new Error(`Failed to load watchlist: ${res.status}`);
  }
  const body = (await res.json()) as {
    data: Array<{
      watchlistId: string;
      auctionId: string;
      createdAt: string;
      auction: unknown | null;
    }>;
  };
  return body.data.map((row) => ({
    watchlistId: row.watchlistId,
    auctionId: row.auctionId,
    createdAt: new Date(row.createdAt),
    auction: row.auction ? parseAuction(row.auction) : null,
  }));
}
