import type { IAuctionStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IAuctionRepository, IBidRepository } from "./interfaces/repositories.js";

/**
 * Scheduled status transitions (scheduled→active, active→ended + winner),
 * Dutch price decrements, and single-auction job hooks for BullMQ.
 */
export class AuctionLifecycleService {
  constructor(
    private readonly auctions: IAuctionRepository,
    private readonly bids: IBidRepository,
    private readonly strategyFactory: IAuctionStrategyFactory,
  ) {}

  async runDutchDecrements(now: Date = new Date()): Promise<void> {
    const dutch = await this.auctions.findActiveDutchAuctions();
    for (const a of dutch) {
      const intervalMs = a.dutchDecrementIntervalMs;
      const lastMs = a.dutchLastDecrementAt?.getTime() ?? a.startTime.getTime();
      if (now.getTime() - lastMs < intervalMs) continue;

      const decDefault = Math.max(0.01, Number(a.startingPrice) * 0.01);
      const dec =
        a.dutchDecrementAmount !== null && a.dutchDecrementAmount !== ""
          ? Number(a.dutchDecrementAmount)
          : decDefault;
      const safeDec = Number.isFinite(dec) && dec > 0 ? dec : decDefault;

      const floor =
        a.reservePrice !== null && a.reservePrice !== "" ? Number(a.reservePrice) : 0.01;
      const safeFloor = Number.isFinite(floor) && floor > 0 ? floor : 0.01;

      const cur = Number(a.currentPrice);
      if (!Number.isFinite(cur)) continue;
      const next = Math.max(safeFloor, cur - safeDec);
      if (next >= cur - 1e-9) continue;

      await this.auctions.updateDutchCurrentPrice(a.id, next.toFixed(2), now);
    }
  }

  async runTransitions(now: Date = new Date()): Promise<void> {
    const toActivate = await this.auctions.findScheduledToActivate(now);
    for (const a of toActivate) {
      await this.auctions.updateStatus(a.id, "active");
      if (a.auctionType === "dutch") {
        await this.auctions.setDutchLastDecrementAt(a.id, now);
      }
    }

    await this.runDutchDecrements(now);

    const toEnd = await this.auctions.findActivePastEnd(now);
    for (const a of toEnd) {
      const bids = await this.bids.listForAuctionSettlement(a.id, 10_000);
      const strategy = this.strategyFactory.create(a.auctionType);
      const winnerBid = strategy.determineWinner(a, bids);
      if (
        winnerBid &&
        (!a.reservePrice ||
          a.reservePrice === "" ||
          Number(winnerBid.amount) >= Number(a.reservePrice))
      ) {
        await this.auctions.setWinner(a.id, winnerBid.bidderId);
      }
      await this.auctions.updateStatus(a.id, "ended");
    }
  }

  /** Idempotent activation for delayed jobs. */
  async processActivateJob(auctionId: string, now: Date = new Date()): Promise<void> {
    const a = await this.auctions.findById(auctionId);
    if (!a || a.status !== "scheduled" || a.startTime > now) return;
    await this.auctions.updateStatus(auctionId, "active");
    if (a.auctionType === "dutch") {
      await this.auctions.setDutchLastDecrementAt(a.id, now);
    }
  }

  /** Idempotent end for delayed jobs. */
  async processEndJob(auctionId: string, now: Date = new Date()): Promise<void> {
    const a = await this.auctions.findById(auctionId);
    if (!a || a.status !== "active" || a.endTime > now) return;
    const bids = await this.bids.listForAuctionSettlement(a.id, 10_000);
    const strategy = this.strategyFactory.create(a.auctionType);
    const winnerBid = strategy.determineWinner(a, bids);
    if (
      winnerBid &&
      (!a.reservePrice ||
        a.reservePrice === "" ||
        Number(winnerBid.amount) >= Number(a.reservePrice))
    ) {
      await this.auctions.setWinner(a.id, winnerBid.bidderId);
    }
    await this.auctions.updateStatus(a.id, "ended");
  }
}
