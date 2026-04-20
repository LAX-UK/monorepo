import type { bid, itemSubmission, lot, sale } from "@auction/db/schema";
import type {
  Bid,
  ItemSubmission,
  ItemSubmissionStatus,
  Lot,
  LotAuctionType,
  LotStatus,
  Sale,
  SaleDeliveryMode,
  SaleStatus,
} from "@auction/types";
import type { InferSelectModel } from "drizzle-orm";

type LotRow = InferSelectModel<typeof lot>;
type BidRow = InferSelectModel<typeof bid>;
type SaleRow = InferSelectModel<typeof sale>;
type ItemSubmissionRow = InferSelectModel<typeof itemSubmission>;

export function mapLotRow(row: LotRow): Lot {
  return {
    id: row.id,
    saleId: row.saleId ?? null,
    lotNumber: row.lotNumber ?? null,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    medium: row.medium ?? null,
    dimensions: row.dimensions ?? null,
    images: row.images ?? [],
    categoryId: row.categoryId,
    auctionType: row.auctionType as LotAuctionType,
    startingPrice: String(row.startingPrice),
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    buyNowPrice: row.buyNowPrice !== null ? String(row.buyNowPrice) : null,
    currentPrice: String(row.currentPrice),
    buyerPremiumRate: String(row.buyerPremiumRate),
    minBidIncrement: String(row.minBidIncrement),
    dutchDecrementAmount:
      row.dutchDecrementAmount !== null ? String(row.dutchDecrementAmount) : null,
    dutchDecrementIntervalMs: row.dutchDecrementIntervalMs,
    dutchLastDecrementAt: row.dutchLastDecrementAt ?? null,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status as LotStatus,
    winnerId: row.winnerId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapBidRow(row: BidRow): Bid {
  return {
    id: row.id,
    lotId: row.lotId,
    bidderId: row.bidderId,
    amount: String(row.amount),
    isWinning: row.isWinning,
    isAutoBid: row.isAutoBid,
    maxAutoBidAmount: row.maxAutoBidAmount !== null ? String(row.maxAutoBidAmount) : null,
    createdAt: row.createdAt,
  };
}

export function mapItemSubmissionRow(row: ItemSubmissionRow): ItemSubmission {
  return {
    id: row.id,
    sellerId: row.sellerId,
    title: row.title,
    description: row.description,
    medium: row.medium,
    dimensions: row.dimensions,
    images: row.images ?? [],
    askingPrice: row.askingPrice !== null ? String(row.askingPrice) : null,
    reservePrice: row.reservePrice !== null ? String(row.reservePrice) : null,
    categoryId: row.categoryId,
    submitterNotes: row.submitterNotes,
    status: row.status as ItemSubmissionStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt ?? null,
    reviewNotes: row.reviewNotes,
    rejectionReason: row.rejectionReason,
    convertedLotId: row.convertedLotId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapSaleRow(row: SaleRow): Sale {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverImages: row.coverImages ?? [],
    categoryId: row.categoryId ?? null,
    deliveryMode: (row.deliveryMode ?? "onsite") as SaleDeliveryMode,
    streamUrl: row.streamUrl ?? null,
    status: row.status as SaleStatus,
    startTime: row.startTime,
    endTime: row.endTime,
    previewStartTime: row.previewStartTime ?? null,
    buyerPremiumRate: String(row.buyerPremiumRate),
    terms: row.terms ?? null,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
