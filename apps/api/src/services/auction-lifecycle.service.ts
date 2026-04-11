import type { IAuctionRepository, IBidRepository } from "./interfaces/repositories.js";

/**
 * SRP: scheduled status transitions for auctions (scheduled→active, active→ended + winner).
 */
export class AuctionLifecycleService {
  constructor(
    private readonly auctions: IAuctionRepository,
    private readonly bids: IBidRepository,
  ) {}

  async runTransitions(now: Date = new Date()): Promise<void> {
    const toActivate = await this.auctions.findScheduledToActivate(now);
    for (const a of toActivate) {
      await this.auctions.updateStatus(a.id, "active");
    }

    const toEnd = await this.auctions.findActivePastEnd(now);
    for (const a of toEnd) {
      const high = await this.bids.findHighestForAuction(a.id);
      const winnerId = high?.bidderId ?? null;
      if (winnerId) {
        await this.auctions.setWinner(a.id, winnerId);
      }
      await this.auctions.updateStatus(a.id, "ended");
    }
  }
}
