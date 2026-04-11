import type { Auction, Bid } from "@auction/types";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";

/**
 * SRP: read models for dashboard views that join bids + auctions.
 */
export class DashboardQueryService {
  constructor(private readonly repos: IRepositoryFactory) {}

  async listBidsWithAuctionsForBidder(
    bidderId: string,
  ): Promise<Array<{ bid: Bid; auction: Auction | null }>> {
    const bids = await this.repos.root.bid.listForBidder(bidderId, 200);
    const auctionIds = [...new Set(bids.map((b) => b.auctionId))];
    const auctionMap = new Map<string, Auction>();
    for (const id of auctionIds) {
      const a = await this.repos.root.auction.findById(id);
      if (a) auctionMap.set(id, a);
    }
    return bids.map((b) => ({ bid: b, auction: auctionMap.get(b.auctionId) ?? null }));
  }
}
