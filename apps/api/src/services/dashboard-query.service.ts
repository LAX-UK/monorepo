import type { Bid, Lot } from "@auction/types";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";

/** SRP: read models for dashboard views that join bids + lots.
 */
export class DashboardQueryService {
  constructor(private readonly repos: IRepositoryFactory) {}

  async listBidsWithLotsForBidder(bidderId: string): Promise<Array<{ bid: Bid; lot: Lot | null }>> {
    const bids = await this.repos.root.bid.listForBidder(bidderId, 200);
    const lotIds = [...new Set(bids.map((b) => b.lotId))];
    const lotMap = new Map<string, Lot>();
    for (const id of lotIds) {
      const a = await this.repos.root.lot.findById(id);
      if (a) lotMap.set(id, a);
    }
    return bids.map((b) => ({ bid: b, lot: lotMap.get(b.lotId) ?? null }));
  }
}
