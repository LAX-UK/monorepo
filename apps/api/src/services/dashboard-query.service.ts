import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { Bid, Lot } from "@auction/types";

type BidWithLotRow = { bid: Bid; lot: Lot | null };

/** The latest bids a list reads; the same for a person and for an account. */
const BIDS_LIMIT = 200;

/** SRP: read models for dashboard views that join bids + lots.
 */
export class DashboardQueryService {
  constructor(private readonly repos: IRepositoryFactory) {}

  async listBidsWithLotsForBidder(bidderId: string): Promise<BidWithLotRow[]> {
    const bids = await this.repos.root.bid.listForBidder(bidderId, BIDS_LIMIT);
    return this.withLots(bids);
  }

  /** Bids placed for a buyer account; `bidderId` narrows to one member's, `saleId` to one sale. */
  async listBidsWithLotsForBuyerAccount(
    buyerLegalEntityId: string,
    bidderId: string | null,
    saleId?: string,
  ): Promise<BidWithLotRow[]> {
    const bids = await this.repos.root.bid.listForBuyerAccount(
      buyerLegalEntityId,
      bidderId,
      BIDS_LIMIT,
      saleId,
    );
    return this.withLots(bids);
  }

  private async withLots(bids: Bid[]): Promise<BidWithLotRow[]> {
    const lotIds = [...new Set(bids.map((b) => b.lotId))];
    const lotRows = await this.repos.root.lot.findByIds(lotIds);
    const lotMap = new Map(lotRows.map((l) => [l.id, l]));
    return bids.map((b) => ({ bid: b, lot: lotMap.get(b.lotId) ?? null }));
  }
}
