import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { moneyGte } from "@auction/validators";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type { ILotNotificationSender } from "./interfaces/notifications.js";
import type { ISaleRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleroomSessionLookup } from "./interfaces/saleroom-session-lookup.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

import type { LotEndedTrigger } from "@auction/types";

type LotCloseOutcome = {
  lotId: string;
  winnerId: string | null;
  voided: boolean;
  winningBid: Bid | null;
  trigger: LotEndedTrigger;
  hadBids: boolean;
};

/** Scheduled status transitions (scheduled→active, active→ended + winner),
 * Dutch price decrements, and single-lot job hooks for BullMQ.
 */
export class LotLifecycleService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly watchlist: IWatchlistRepository | null,
    private readonly cache: ICacheProvider | null,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly notificationFactory: NotificationFactory,
    private readonly antiShillingGuard: IAntiShillingGuard | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
    /** Optional hook after a lot transitions to `active` (e.g. absentee replay). */
    private readonly onLotActivated: ((lotId: string) => Promise<void>) | null = null,
    private readonly lotLifecycleRecording: LotLifecycleRecording | null = null,
    /** Realtime lot channel (`lot:{id}:events` → WebSocket `lotEnded`). */
    private readonly lotNotifications: ILotNotificationSender | null = null,
    private readonly notificationOutbox: INotificationOutboxService | null = null,
    private readonly saleroomSessionLookup: ISaleroomSessionLookup | null = null,
    private readonly saleRepo: ISaleRepository | null = null,
  ) {}

  private async shouldSkipTimedCloseForLot(lotId: string): Promise<boolean> {
    if (!this.saleroomSessionLookup) return false;
    return this.saleroomSessionLookup.isLotUnderLiveClerkSession(lotId);
  }

  async runDutchDecrements(now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const dutch = await lots.findActiveDutchLots();
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

      const expected = a.currentPrice;
      const nextStr = next.toFixed(2);
      await lots.updateDutchCurrentPriceIfMatch(a.id, expected, nextStr, now);
    }
  }

  async runTransitions(now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const toActivate = await lots.findScheduledToActivate(now);
    for (const a of toActivate) {
      await this.repos.runInTransaction(async ({ lot }, tx) => {
        const row = await lot.findByIdForUpdate(a.id);
        if (!row || row.status !== "scheduled" || row.startTime > now) return;
        await lot.updateStatus(a.id, "active");
        if (a.auctionType === "dutch") {
          await lot.setDutchLastDecrementAt(a.id, now);
        }
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordActivated(tx, row, now);
        }
      });
      await this.notifyWatchlistStarting(a);
      await this.onLotActivated?.(a.id);
    }

    await this.runDutchDecrements(now);

    await this.notifyEndingSoonBuckets(now);

    const toEnd = await lots.findActivePastEnd(now);
    for (const a of toEnd) {
      await this.finalizeLotEnding(a, now);
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

  /** Same settlement rules as timed close, but ignores the auction clock (clerk hammer). */
  async finalizeActiveLotFromClerkHammer(
    lotId: string,
  ): Promise<{ winnerId: string | null; voided: boolean } | null> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active") return null;
    const outcome = await this.runFinalizeLotTransaction(a, new Date(), true);
    if (!outcome) return null;
    await this.notifyBiddersAfterLotClose(a, outcome);
    return { winnerId: outcome.winnerId, voided: outcome.voided };
  }

  /** Clerk declares no sale: end the active lot without a winner (reserve not met / passed). */
  async noSaleEndActiveLotFromClerk(lotId: string): Promise<boolean> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active") return false;
    const ok = await this.repos.runInTransaction(async ({ lot, bid }, tx) => {
      const row = await lot.findByIdForUpdate(lotId);
      if (!row || row.status !== "active") return false;
      await bid.clearWinningBid(lotId);
      await lot.updateStatus(lotId, "ended");
      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordEnded(tx, {
          lot: row,
          payload: {
            outcome: "no_sale",
            winnerId: null,
            saleId: row.saleId,
            trigger: "clerk_no_sale",
          },
        });
      }
      await this.stageLotCloseNotificationsInTransaction({
        lot: row,
        winnerId: null,
        bid,
        tx,
      });
      return true;
    });
    if (!ok) return false;
    const bids = this.repos.root.bid;
    const hadBids = (await bids.listForLotSettlement(lotId, 1)).length > 0;
    await this.notifyBiddersAfterLotClose(a, {
      lotId,
      winnerId: null,
      voided: false,
      winningBid: null,
      trigger: "clerk_no_sale",
      hadBids,
    });
    return true;
  }

  /** Finalize all still-active lots on a sale (e.g. when saleroom session closes). */
  async finalizeActiveLotsPastEnd(saleId: string, now: Date = new Date()): Promise<number> {
    const lots = this.repos.root.lot;
    const saleLots = await lots.findBySaleId(saleId);
    let closed = 0;
    for (const a of saleLots) {
      if (a.status !== "active") continue;
      const outcome = await this.runFinalizeLotTransaction(a, now, true);
      if (outcome) {
        closed += 1;
        await this.notifyBiddersAfterLotClose(a, outcome);
      }
    }
    return closed;
  }

  private async runFinalizeLotTransaction(
    a: Lot,
    now: Date,
    ignoreEndTime: boolean,
  ): Promise<LotCloseOutcome | null> {
    return this.repos.runInTransaction(async ({ lot, bid }, tx) => {
      const row = await lot.findByIdForUpdate(a.id);
      if (!row || row.status !== "active") {
        return null;
      }
      if (!ignoreEndTime && row.endTime > now) {
        return null;
      }
      const bidsList = await bid.listForLotSettlement(row.id, 10_000);
      const ordered =
        row.auctionType === "dutch"
          ? [...bidsList].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())
          : bidsList;

      const meetsReserve = (b: Bid) =>
        !row.reservePrice || row.reservePrice === "" || moneyGte(b.amount, row.reservePrice);

      const reserveMet = ordered.filter((b) =>
        Boolean(b.placedByUserId && b.buyerLegalEntityId && meetsReserve(b)),
      );

      let chosen: Bid | undefined;
      if (reserveMet.length === 0) {
        chosen = undefined;
      } else if (!this.antiShillingGuard) {
        chosen = reserveMet[0];
      } else {
        const sqlEligible = await bid.findEligibleBidsForLotClose(row.id, {
          sellerLegalEntityId: row.sellerLegalEntityId ?? null,
          reservePrice: row.reservePrice ?? null,
          sort: row.auctionType === "dutch" ? "dutch" : "english",
        });
        chosen = sqlEligible[0];
      }

      let winnerId: string | null = null;
      let voided = false;

      if (chosen?.placedByUserId && chosen.buyerLegalEntityId) {
        await lot.setWinner(row.id, chosen.placedByUserId, chosen.buyerLegalEntityId);
        winnerId = chosen.placedByUserId;
      } else if (reserveMet.length > 0 && this.antiShillingGuard && !chosen) {
        await lot.voidLotAntiShillingClose(row.id);
        voided = true;
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordVoided(tx, row, "no_valid_winner");
        } else if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "lot",
            aggregateId: row.id,
            eventType: "lot.voided",
            payload: { reason: "no_valid_winner", lotId: row.id },
            actorUserId: null,
            actingLegalEntityId: row.sellerLegalEntityId ?? null,
            schemaVersion: 1,
            producer: "apps/api",
          });
        }
      }

      if (!voided) {
        if (!winnerId) {
          await bid.clearWinningBid(row.id);
        }
        await lot.updateStatus(row.id, "ended");
        if (this.lotLifecycleRecording) {
          await this.lotLifecycleRecording.recordEnded(tx, {
            lot: row,
            payload: {
              outcome: winnerId ? "sold" : "no_sale",
              winnerId,
              saleId: row.saleId,
              trigger: ignoreEndTime ? "clerk_hammer" : "timed",
              hammerPrice: chosen?.amount ?? null,
            },
          });
        }
        await this.stageLotCloseNotificationsInTransaction({
          lot: row,
          winnerId,
          bid,
          tx,
        });
      }
      return {
        lotId: row.id,
        winnerId,
        voided,
        winningBid: chosen ?? null,
        trigger: ignoreEndTime ? "clerk_hammer" : "timed",
        hadBids: bidsList.length > 0,
      };
    });
  }

  private async stageLotCloseNotificationsInTransaction(params: {
    lot: Lot;
    winnerId: string | null;
    bid: { listDistinctBidderIds(lotId: string): Promise<string[]> };
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

  private async notifyBiddersAfterLotClose(a: Lot, outcome: LotCloseOutcome): Promise<void> {
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
      console.error(`[LotLifecycleService] ${label} failed`, err);
    }
  }

  private async finalizeLotEnding(a: Lot, now: Date): Promise<void> {
    if (await this.shouldSkipTimedCloseForLot(a.id)) return;
    const outcome = await this.runFinalizeLotTransaction(a, now, false);
    if (!outcome) return;
    await this.notifyBiddersAfterLotClose(a, outcome);
  }

  /** Idempotent activation for delayed jobs. */
  async processActivateJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "scheduled" || a.startTime > now) return;
    await this.repos.runInTransaction(async ({ lot }, tx) => {
      const row = await lot.findByIdForUpdate(lotId);
      if (!row || row.status !== "scheduled" || row.startTime > now) return;
      await lot.updateStatus(lotId, "active");
      if (a.auctionType === "dutch") {
        await lot.setDutchLastDecrementAt(a.id, now);
      }
      if (this.lotLifecycleRecording) {
        await this.lotLifecycleRecording.recordActivated(tx, row, now);
      }
    });
    await this.notifyWatchlistStarting(a);
    await this.onLotActivated?.(lotId);
  }

  /** Idempotent end for delayed jobs. */
  async processEndJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active" || a.endTime > now) return;
    if (await this.shouldSkipTimedCloseForLot(lotId)) return;
    await this.finalizeLotEnding(a, now);
  }
}
