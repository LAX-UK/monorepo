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
};

export type AuctionStateEvent = {
  auctionId: string;
  currentPrice: string;
  endTime: string;
  status: string;
};
