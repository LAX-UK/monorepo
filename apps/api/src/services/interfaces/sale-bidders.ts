export type SaleBidderRow = {
  /** First name + first initial of last name (privacy-preserving). */
  maskedName: string;
  /** When the bidder first placed a bid in this sale. */
  firstBidAt: Date;
};

export interface ISaleBiddersReader {
  /** Distinct bidders across all lots in the sale, paged by first-bid time ASC. */
  list(saleId: string, opts: { limit: number; offset: number }): Promise<SaleBidderRow[]>;
  countDistinct(saleId: string): Promise<number>;
}
