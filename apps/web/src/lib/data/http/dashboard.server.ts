import "server-only";
import { parseAuction, parseBid } from "@/lib/data/http/parse";
import type { Auction, Bid } from "@auction/types";
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

export async function getServerMyPortfolio(): Promise<Auction[]> {
  const res = await authedFetch("/users/me/portfolio");
  if (!res.ok) {
    throw new Error(`Failed to load portfolio: ${res.status}`);
  }
  const body = (await res.json()) as { data: unknown[] };
  return body.data.map(parseAuction);
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
