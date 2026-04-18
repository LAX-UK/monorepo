export type Bid = {
  id: string;
  lotId: string;
  bidderId: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
  createdAt: Date;
};

export type NewBid = {
  bidderId: string;
  amount: number;
};
