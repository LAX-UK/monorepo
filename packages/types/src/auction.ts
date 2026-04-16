export const auctionTypes = ["english", "dutch", "sealed", "buy_it_now"] as const;
export type AuctionType = (typeof auctionTypes)[number];

export const auctionStatuses = ["draft", "scheduled", "active", "ended", "cancelled"] as const;
export type AuctionStatus = (typeof auctionStatuses)[number];

export type Auction = {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  /** Physical / catalog medium (e.g. oil on canvas). */
  medium: string | null;
  /** Display dimensions (e.g. 180 x 140 cm). */
  dimensions: string | null;
  images: string[];
  categoryId: string | null;
  auctionType: AuctionType;
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
  status: AuctionStatus;
  winnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAuctionInput = {
  title: string;
  description?: string | undefined;
  medium?: string | undefined;
  dimensions?: string | undefined;
  images?: string[] | undefined;
  categoryId?: string | undefined;
  auctionType: AuctionType;
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
};
