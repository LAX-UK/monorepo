import type { Database } from "@auction/db";
import type { LotCloseOutcome } from "@auction/lot-lifecycle-app";
import type { ILotLifecycleNotifications } from "@auction/lot-lifecycle-app";
import type {
  INotificationOutboxRepository,
  ISaleRepository,
  IWatchlistRepository,
} from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { computeLotCheckoutPricing } from "@auction/validators";
import type { Redis } from "ioredis";
import {
  WorkerNotificationFactory,
  notificationRowToPayload,
} from "./worker-notification-factory.js";

export type WorkerLotLifecycleNotificationsDeps = {
  repoFactory: IRepositoryFactory;
  watchlist: IWatchlistRepository;
  redis: Redis;
  notificationOutbox: INotificationOutboxRepository;
  saleRepo: ISaleRepository;
  factory?: WorkerNotificationFactory;
};

/** Worker implementation of lot lifecycle notifications (outbox + Redis dedupe). */
export class WorkerLotLifecycleNotifications implements ILotLifecycleNotifications {
  private readonly factory: WorkerNotificationFactory;

  constructor(private readonly deps: WorkerLotLifecycleNotificationsDeps) {
    this.factory = deps.factory ?? new WorkerNotificationFactory();
  }

  async notifyWatchlistStarting(a: Lot): Promise<void> {
    const watchers = await this.deps.watchlist.listUserIdsForLot(a.id);
    for (const uid of watchers) {
      await this.deps.notificationOutbox.stage({
        userId: uid,
        payload: notificationRowToPayload(this.factory.createWatchlistStarting(a, uid)),
        idempotencyKey: `watchlist_starting:${a.id}:${uid}`,
      });
    }
  }

  async notifyEndingSoonBuckets(now: Date): Promise<void> {
    const lots = this.deps.repoFactory.root.lot;
    const bids = this.deps.repoFactory.root.bid;
    const windowStart = new Date(now.getTime() + 59 * 60_000);
    const windowEnd = new Date(now.getTime() + 61 * 60_000);
    const almostEnding = await lots.findActiveByEndTimeBetween(windowStart, windowEnd);
    for (const a of almostEnding) {
      const cacheKey = `endingSoonLot:${a.id}`;
      const sent = await this.deps.redis.get(cacheKey);
      if (sent) continue;
      await this.deps.redis.set(cacheKey, "1", "EX", 7200);
      const bidderAccounts = new Map(
        (await bids.listDistinctBidderAccounts(a.id)).map((b) => [b.userId, b.legalEntityId]),
      );
      const watchers = await this.deps.watchlist.listUserIdsForLot(a.id);
      const recipients = new Set([...bidderAccounts.keys(), ...watchers]);
      for (const uid of recipients) {
        const account = bidderAccounts.get(uid);
        const row =
          account === undefined
            ? this.factory.createWatchlistEndingSoon(a, uid)
            : this.factory.createEndingSoon(a, uid, account);
        await this.deps.notificationOutbox.stage({
          userId: uid,
          payload: notificationRowToPayload(row),
          idempotencyKey: `ending_soon:${a.id}:${uid}`,
        });
      }
    }
  }

  async stageLotCloseNotificationsInTransaction(params: {
    lot: Lot;
    winnerId: string | null;
    bid: {
      listForLotSettlement(lotId: string, limit: number): Promise<import("@auction/types").Bid[]>;
    };
    tx: Database;
  }): Promise<void> {
    let hammerPrice: string | undefined;
    if (params.winnerId) {
      const sale = params.lot.saleId ? await this.deps.saleRepo.findById(params.lot.saleId) : null;
      const pricing = computeLotCheckoutPricing(params.lot, sale ?? null);
      hammerPrice = pricing.hammerMajor;
      await this.deps.notificationOutbox.stage(
        {
          userId: params.winnerId,
          payload: notificationRowToPayload(
            this.factory.createWon(params.lot, params.winnerId, {
              hammerPrice: pricing.hammerMajor,
              totalDue: pricing.totalMajor,
            }),
          ),
          idempotencyKey: `lot_won:${params.lot.id}:${params.winnerId}`,
        },
        params.tx,
      );
    }

    // The consignor learns the outcome, sold or unsold, whether or not anyone bid.
    if (params.lot.sellerId) {
      await this.deps.notificationOutbox.stage(
        {
          userId: params.lot.sellerId,
          payload: notificationRowToPayload(
            this.factory.createEndedSeller(params.lot, params.lot.sellerId, {
              ...(hammerPrice ? { hammerPrice } : {}),
            }),
          ),
          idempotencyKey: `lot_ended_seller:${params.lot.id}:${params.lot.sellerId}`,
        },
        params.tx,
      );
    }

    const settlementBids = await params.bid.listForLotSettlement(params.lot.id, 500);
    // Each losing bidder once, with the account of their first bid in settlement order.
    const bidderAccounts = new Map<string, string | null>();
    for (const b of settlementBids) {
      const uid = b.placedByUserId ?? b.bidderId;
      if (typeof uid === "string" && uid.length > 0 && !bidderAccounts.has(uid)) {
        bidderAccounts.set(uid, b.buyerLegalEntityId ?? null);
      }
    }
    for (const [uid, legalEntityId] of bidderAccounts) {
      if (uid === params.winnerId) continue;
      await this.deps.notificationOutbox.stage(
        {
          userId: uid,
          payload: notificationRowToPayload(
            this.factory.createLost(params.lot, uid, legalEntityId),
          ),
          idempotencyKey: `lot_lost:${params.lot.id}:${uid}`,
        },
        params.tx,
      );
    }
  }

  async notifyBiddersAfterLotClose(_a: Lot, _outcome: LotCloseOutcome): Promise<void> {
    // Marketing realtime fan-out remains on API paths; outbox rows cover buyer comms.
  }
}
