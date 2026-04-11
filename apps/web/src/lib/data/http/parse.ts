import type { Auction, Bid } from "@auction/types";

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return new Date(Number.NaN);
}

export function parseAuction(raw: unknown): Auction {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    sellerId: String(o.sellerId),
    title: String(o.title),
    description: o.description == null ? null : String(o.description),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    categoryId: o.categoryId == null ? null : String(o.categoryId),
    auctionType: o.auctionType as Auction["auctionType"],
    startingPrice: String(o.startingPrice),
    reservePrice: o.reservePrice == null ? null : String(o.reservePrice),
    buyNowPrice: o.buyNowPrice == null ? null : String(o.buyNowPrice),
    currentPrice: String(o.currentPrice),
    startTime: toDate(o.startTime),
    endTime: toDate(o.endTime),
    status: o.status as Auction["status"],
    winnerId: o.winnerId == null ? null : String(o.winnerId),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

export function parseBid(raw: unknown): Bid {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    auctionId: String(o.auctionId),
    bidderId: String(o.bidderId),
    amount: String(o.amount),
    isWinning: Boolean(o.isWinning),
    isAutoBid: Boolean(o.isAutoBid),
    maxAutoBidAmount: o.maxAutoBidAmount == null ? null : String(o.maxAutoBidAmount),
    createdAt: toDate(o.createdAt),
  };
}
