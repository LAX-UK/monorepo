export type JoinAuctionPayload = {
  auctionId: string;
};

export type PlaceBidPayload = {
  auctionId: string;
  amount: number;
};

export type BidUpdateEvent = {
  auctionId: string;
  bidId: string;
  bidderId: string;
  amount: string;
  currentPrice: string;
  endTime?: string | undefined;
  /** Present when the previous high bidder was displaced (for outbid toasts). */
  outbidUserId?: string | undefined;
};

export type AuctionEndedEvent = {
  type: "auction_ended";
  auctionId: string;
  winnerId: string;
  bidId: string;
  currentPrice: string;
  status: string;
};

export type AuctionStateEvent = {
  auctionId: string;
  currentPrice: string;
  endTime: string;
  status: string;
};
