import type { IRepositoryFactory } from "@auction/persistence";
import type { Bid, Lot } from "@auction/types";

/** SRP: read models for dashboard views that join bids + lots.
 */
export class DashboardQueryService {
  constructor(private readonly repos: IRepositoryFactory) {}

  async listBidsWithLotsForBidder(bidderId: string): Promise<Array<{ bid: Bid; lot: Lot | null }>> {
    const bids = await this.repos.root.bid.listForBidder(bidderId, 200);
    const lotIds = [...new Set(bids.map((b) => b.lotId))];
    const lotRows = await this.repos.root.lot.findByIds(lotIds);
    const lotMap = new Map(lotRows.map((l) => [l.id, l]));
    return bids.map((b) => ({ bid: b, lot: lotMap.get(b.lotId) ?? null }));
  }
}
