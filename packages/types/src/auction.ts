export const auctionTypes = ["english", "dutch", "sealed", "buy_it_now"] as const;
export type AuctionType = (typeof auctionTypes)[number];

export const auctionStatuses = [
  "draft",
  "scheduled",
  "active",
  "ended",
  "cancelled",
] as const;
export type AuctionStatus = (typeof auctionStatuses)[number];

export type Auction = {
  id: string;
  sellerId: string;
  title: string;
  description: string | null;
  images: string[];
  categoryId: string | null;
  auctionType: AuctionType;
  startingPrice: string;
  reservePrice: string | null;
  buyNowPrice: string | null;
  currentPrice: string;
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
  images?: string[] | undefined;
  categoryId?: string | undefined;
  auctionType: AuctionType;
  startingPrice: string;
  reservePrice?: string | undefined;
  buyNowPrice?: string | undefined;
  startTime: Date;
  endTime: Date;
};
