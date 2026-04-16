import type { auction, bid } from "@auction/db/schema";
import type { Auction, AuctionStatus, AuctionType } from "@auction/types";
import type { Bid } from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type AuctionRow = InferSelectModel<typeof auction>;
type BidRow = InferSelectModel<typeof bid>;

export function mapAuctionRow(row: AuctionRow): Auction {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    medium: row.medium ?? null,
    dimensions: row.dimensions ?? null,
    images: row.images ?? [],
    categoryId: row.categoryId,
    auctionType: row.auctionType as AuctionType,
    startingPrice: String(row.startingPrice),
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    buyNowPrice: row.buyNowPrice !== null ? String(row.buyNowPrice) : null,
    currentPrice: String(row.currentPrice),
    buyerPremiumRate: String(row.buyerPremiumRate),
    minBidIncrement: String(row.minBidIncrement),
    dutchDecrementAmount: row.dutchDecrementAmount !== null ? String(row.dutchDecrementAmount) : null,
    dutchDecrementIntervalMs: row.dutchDecrementIntervalMs,
    dutchLastDecrementAt: row.dutchLastDecrementAt ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status as AuctionStatus,
    winnerId: row.winnerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapBidRow(row: BidRow): Bid {
  return {
    id: row.id,
    auctionId: row.auctionId,
    bidderId: row.bidderId,
    amount: String(row.amount),
    isWinning: row.isWinning,
    isAutoBid: row.isAutoBid,
    maxAutoBidAmount: row.maxAutoBidAmount !== null ? String(row.maxAutoBidAmount) : null,
    createdAt: row.createdAt,
  };
}
