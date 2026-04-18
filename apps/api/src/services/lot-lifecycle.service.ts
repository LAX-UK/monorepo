import type { Lot } from "@auction/types";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IBidRepository, ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

/**
 * Scheduled status transitions (scheduled→active, active→ended + winner),
 * Dutch price decrements, and single-lot job hooks for BullMQ.
 */
export class LotLifecycleService {
  constructor(
    private readonly lots: ILotRepository,
    private readonly bids: IBidRepository,
    private readonly strategyFactory: ILotStrategyFactory,
    private readonly watchlist: IWatchlistRepository | null,
    private readonly cache: ICacheProvider | null,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
  ) {}

  async runDutchDecrements(now: Date = new Date()): Promise<void> {
    const dutch = await this.lots.findActiveDutchLots();
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

      await this.lots.updateDutchCurrentPrice(a.id, next.toFixed(2), now);
    }
  }

  async runTransitions(now: Date = new Date()): Promise<void> {
    const toActivate = await this.lots.findScheduledToActivate(now);
    for (const a of toActivate) {
      await this.lots.updateStatus(a.id, "active");
      if (a.auctionType === "dutch") {
        await this.lots.setDutchLastDecrementAt(a.id, now);
      }
      await this.notifyWatchlistStarting(a);
    }

    await this.runDutchDecrements(now);

    await this.notifyEndingSoonBuckets(now);

    const toEnd = await this.lots.findActivePastEnd(now);
    for (const a of toEnd) {
      await this.finalizeLotEnding(a);
    }
  }

  private async notifyWatchlistStarting(a: Lot): Promise<void> {
    if (!this.watchlist || !this.notificationDispatcher) return;
    const watchers = await this.watchlist.listUserIdsForLot(a.id);
    for (const uid of watchers) {
      await this.notificationDispatcher.dispatch(
        uid,
        notificationRowToPayload(this.notificationFactory.createWatchlistStarting(a, uid)),
      );
    }
  }

  private async notifyEndingSoonBuckets(now: Date): Promise<void> {
    if (!this.notificationDispatcher || !this.cache || !this.watchlist) return;
    const windowStart = new Date(now.getTime() + 59 * 60_000);
    const windowEnd = new Date(now.getTime() + 61 * 60_000);
    const almostEnding = await this.lots.findActiveByEndTimeBetween(windowStart, windowEnd);
    for (const a of almostEnding) {
      const cacheKey = `endingSoonLot:${a.id}`;
      const sent = await this.cache.get(cacheKey);
      if (sent) continue;
      await this.cache.set(cacheKey, "1", 7200);
      const bidderIds = await this.bids.listDistinctBidderIds(a.id);
      const watchers = await this.watchlist.listUserIdsForLot(a.id);
      const recipients = new Set([...bidderIds, ...watchers]);
      for (const uid of recipients) {
        const onlyWatcher = watchers.includes(uid) && !bidderIds.includes(uid);
        const row = onlyWatcher
          ? this.notificationFactory.createWatchlistEndingSoon(a, uid)
          : this.notificationFactory.createEndingSoon(a, uid);
        await this.notificationDispatcher.dispatch(uid, notificationRowToPayload(row));
      }
    }
  }

  private async finalizeLotEnding(a: Lot): Promise<void> {
    const bids = await this.bids.listForLotSettlement(a.id, 10_000);
    const strategy = this.strategyFactory.create(a.auctionType);
    const winnerBid = strategy.determineWinner(a, bids);
    let winnerId: string | null = null;
    if (
      winnerBid &&
      (!a.reservePrice ||
        a.reservePrice === "" ||
        Number(winnerBid.amount) >= Number(a.reservePrice))
    ) {
      await this.lots.setWinner(a.id, winnerBid.bidderId);
      winnerId = winnerBid.bidderId;
    }
    await this.lots.updateStatus(a.id, "ended");

    if (!this.notificationDispatcher) return;
    const bidderIds = await this.bids.listDistinctBidderIds(a.id);
    if (winnerId) {
      await this.notificationDispatcher.dispatch(
        winnerId,
        notificationRowToPayload(this.notificationFactory.createWon(a, winnerId)),
      );
    }
    for (const uid of bidderIds) {
      if (uid === winnerId) continue;
      await this.notificationDispatcher.dispatch(
        uid,
        notificationRowToPayload(this.notificationFactory.createLost(a, uid)),
      );
    }
  }

  /** Idempotent activation for delayed jobs. */
  async processActivateJob(lotId: string, now: Date = new Date()): Promise<void> {
    const a = await this.lots.findById(lotId);
    if (!a || a.status !== "scheduled" || a.startTime > now) return;
    await this.lots.updateStatus(lotId, "active");
    if (a.auctionType === "dutch") {
      await this.lots.setDutchLastDecrementAt(a.id, now);
    }
    await this.notifyWatchlistStarting(a);
  }

  /** Idempotent end for delayed jobs. */
  async processEndJob(lotId: string, now: Date = new Date()): Promise<void> {
    const a = await this.lots.findById(lotId);
    if (!a || a.status !== "active" || a.endTime > now) return;
    await this.finalizeLotEnding(a);
  }
}
