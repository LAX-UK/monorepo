import type { Auction, Bid, UserNotification } from "@auction/types";

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
    medium: o.medium == null || o.medium === "" ? null : String(o.medium),
    dimensions: o.dimensions == null || o.dimensions === "" ? null : String(o.dimensions),
    images: Array.isArray(o.images) ? (o.images as unknown[]).map(String) : [],
    categoryId: o.categoryId == null ? null : String(o.categoryId),
    auctionType: o.auctionType as Auction["auctionType"],
    startingPrice: String(o.startingPrice),
    reservePrice: o.reservePrice == null ? null : String(o.reservePrice),
    buyNowPrice: o.buyNowPrice == null ? null : String(o.buyNowPrice),
    currentPrice: String(o.currentPrice),
    buyerPremiumRate:
      o.buyerPremiumRate == null || o.buyerPremiumRate === "" ? "0.25" : String(o.buyerPremiumRate),
    startTime: toDate(o.startTime),
    endTime: toDate(o.endTime),
    status: o.status as Auction["status"],
    winnerId: o.winnerId == null ? null : String(o.winnerId),
    createdAt: toDate(o.createdAt),
    updatedAt: toDate(o.updatedAt),
  };
}

export function parseUserNotification(raw: unknown): UserNotification {
  const o = raw as Record<string, unknown>;
  return {
    id: String(o.id),
    userId: String(o.userId),
    type: String(o.type),
    title: String(o.title),
    message: String(o.message),
    auctionId: o.auctionId == null ? null : String(o.auctionId),
    read: Boolean(o.read),
    createdAt: toDate(o.createdAt),
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
