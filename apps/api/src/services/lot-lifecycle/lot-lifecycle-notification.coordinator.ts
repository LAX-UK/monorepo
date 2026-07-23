import type { Database } from "@auction/db";
import type { LotCloseOutcome } from "@auction/lot-lifecycle-app";
import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { IWatchlistRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { computeLotCheckoutPricing } from "../../lib/lot-checkout-pricing.js";
import type { ICacheProvider } from "../interfaces/cache.js";
import type { INotificationOutboxService } from "../interfaces/notification-outbox.js";
import type { ILotNotificationSender } from "../interfaces/notifications.js";
import { notificationRowToPayload } from "../notification-payload.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type { NotificationFactory } from "../notification.factory.js";

export class LotLifecycleNotificationCoordinator {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly watchlist: IWatchlistRepository | null,
    private readonly cache: ICacheProvider | null,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly lotNotifications: ILotNotificationSender | null = null,
    private readonly notificationOutbox: INotificationOutboxService | null = null,
    private readonly saleRepo: ISaleRepository | null = null,
  ) {}

  async notifyWatchlistStarting(a: Lot): Promise<void> {
    if (!this.watchlist || !this.notificationDispatcher) return;
    const watchers = await this.watchlist.listUserIdsForLot(a.id);
    for (const uid of watchers) {
      await this.notificationDispatcher.dispatch(
        uid,
        notificationRowToPayload(this.notificationFactory.createWatchlistStarting(a, uid)),
      );
    }
  }

  async notifyEndingSoonBuckets(now: Date): Promise<void> {
    if (!this.notificationDispatcher || !this.cache || !this.watchlist) return;
    const lots = this.repos.root.lot;
    const bids = this.repos.root.bid;
    const windowStart = new Date(now.getTime() + 59 * 60_000);
    const windowEnd = new Date(now.getTime() + 61 * 60_000);
    const almostEnding = await lots.findActiveByEndTimeBetween(windowStart, windowEnd);
    for (const a of almostEnding) {
      const cacheKey = `endingSoonLot:${a.id}`;
      const sent = await this.cache.get(cacheKey);
      if (sent) continue;
      await this.cache.set(cacheKey, "1", 7200);
      const bidderIds = await bids.listDistinctBidderIds(a.id);
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

  async stageLotCloseNotificationsInTransaction(params: {
    lot: Lot;
    winnerId: string | null;
    bid: import("@auction/persistence/interfaces").IBidRepository;
    tx: Database;
  }): Promise<void> {
    if (!this.notificationOutbox) return;

    if (params.winnerId) {
      const sale = params.lot.saleId ? await this.saleRepo?.findById(params.lot.saleId) : null;
      const pricing = computeLotCheckoutPricing(params.lot, sale ?? null);
      await this.notificationOutbox.stageDispatch(
        {
          userId: params.winnerId,
          payload: notificationRowToPayload(
            this.notificationFactory.createWon(params.lot, params.winnerId, {
              hammerPrice: pricing.hammerMajor,
              totalDue: pricing.totalMajor,
            }),
          ),
          idempotencyKey: `lot_won:${params.lot.id}:${params.winnerId}`,
        },
        params.tx,
      );
    }

    const bidderIds = await params.bid.listDistinctBidderIds(params.lot.id);
    for (const uid of bidderIds) {
      if (uid === params.winnerId) continue;
      await this.notificationOutbox.stageDispatch(
        {
          userId: uid,
          payload: notificationRowToPayload(this.notificationFactory.createLost(params.lot, uid)),
          idempotencyKey: `lot_lost:${params.lot.id}:${uid}`,
        },
        params.tx,
      );
    }
  }

  async notifyBiddersAfterLotClose(a: Lot, outcome: LotCloseOutcome): Promise<void> {
    if (outcome.voided) return;

    if (this.lotNotifications) {
      const lotNotifications = this.lotNotifications;
      await this.runBestEffort("notifyLotEnded", () =>
        lotNotifications.notifyLotEnded(a, outcome.winningBid, {
          trigger: outcome.trigger,
          hadBids: outcome.hadBids,
          voided: outcome.voided,
        }),
      );
    }
  }

  private async runBestEffort(label: string, fn: () => void | Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      console.error(`[LotLifecycleNotificationCoordinator] ${label} failed`, err);
    }
  }
}
