/** Matches DB enum `auction_type` on `lot`. */
export const lotAuctionTypes = ["english", "dutch", "sealed", "buy_it_now"] as const;
export type LotAuctionType = (typeof lotAuctionTypes)[number];

export const lotStatuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
export type LotStatus = (typeof lotStatuses)[number];

export type Lot = {
  id: string;
  saleId: string | null;
  lotNumber: number | null;
  sellerId: string;
  title: string;
  description: string | null;
  /** Physical / catalog medium (e.g. oil on canvas). */
  medium: string | null;
  /** Display dimensions (e.g. 180 x 140 cm). */
  dimensions: string | null;
  images: string[];
  categoryId: string;
  auctionType: LotAuctionType;
  startingPrice: string;
  reservePrice: string | null;
  buyNowPrice: string | null;
  currentPrice: string;
  /** Decimal fraction, e.g. "0.25" for 25% buyer's premium on hammer. */
  buyerPremiumRate: string;
  /** Minimum raise over current price (English / buy-it-now paths). */
  minBidIncrement: string;
  /** Amount subtracted from current price each Dutch interval (optional; derived if null). */
  dutchDecrementAmount: string | null;
  dutchDecrementIntervalMs: number;
  dutchLastDecrementAt: Date | null;
  startTime: Date;
  endTime: Date;
  status: LotStatus;
  winnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateLotInput = {
  title: string;
  description?: string | undefined;
  medium?: string | undefined;
  dimensions?: string | undefined;
  images?: string[] | undefined;
  categoryId: string;
  auctionType: LotAuctionType;
  startingPrice: string;
  reservePrice?: string | undefined;
  buyNowPrice?: string | undefined;
  /** Optional; defaults per DB (e.g. 0.25). */
  buyerPremiumRate?: string | undefined;
  minBidIncrement?: string | undefined;
  dutchDecrementAmount?: string | undefined;
  dutchDecrementIntervalMs?: number | undefined;
  startTime: Date;
  endTime: Date;
  saleId?: string | null | undefined;
  lotNumber?: number | null | undefined;
};
