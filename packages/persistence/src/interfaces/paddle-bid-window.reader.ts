/** Detects recent web/self-service bids within the saleroom paddle roster window. */
export interface IPaddleBidWindowReader {
  hasRecentSelfServiceBid(saleId: string, userId: string): Promise<boolean>;
}
