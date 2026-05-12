import type { Bid, Lot } from "@auction/types";
import { moneyGte } from "@auction/validators";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { IWatchlistRepository } from "./interfaces/watchlist.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import type { NotificationFactory } from "./notification.factory.js";

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
  ) {}

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
      await lots.updateStatus(a.id, "active");
      if (a.auctionType === "dutch") {
        await lots.setDutchLastDecrementAt(a.id, now);
      }
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
    const ok = await this.repos.runInTransaction(async ({ lot }) => {
      const row = await lot.findByIdForUpdate(lotId);
      if (!row || row.status !== "active") return false;
      await lot.updateStatus(lotId, "ended");
      return true;
    });
    if (!ok) return false;
    await this.notifyBiddersAfterLotClose(a, { lotId, winnerId: null, voided: false });
    return true;
  }

  private async runFinalizeLotTransaction(
    a: Lot,
    now: Date,
    ignoreEndTime: boolean,
  ): Promise<{ lotId: string; winnerId: string | null; voided: boolean } | null> {
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
        if (this.domainEventPublisher) {
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
        await lot.updateStatus(row.id, "ended");
      }
      return { lotId: row.id, winnerId, voided };
    });
  }

  private async notifyBiddersAfterLotClose(
    a: Lot,
    outcome: { lotId: string; winnerId: string | null; voided: boolean },
  ): Promise<void> {
    if (!this.notificationDispatcher || outcome.voided) return;
    const bids = this.repos.root.bid;
    const bidderIds = await bids.listDistinctBidderIds(outcome.lotId);
    if (outcome.winnerId) {
      await this.notificationDispatcher.dispatch(
        outcome.winnerId,
        notificationRowToPayload(this.notificationFactory.createWon(a, outcome.winnerId)),
      );
    }
    for (const uid of bidderIds) {
      if (uid === outcome.winnerId) continue;
      await this.notificationDispatcher.dispatch(
        uid,
        notificationRowToPayload(this.notificationFactory.createLost(a, uid)),
      );
    }
  }

  private async finalizeLotEnding(a: Lot, now: Date): Promise<void> {
    const outcome = await this.runFinalizeLotTransaction(a, now, false);
    if (!outcome) return;
    await this.notifyBiddersAfterLotClose(a, outcome);
  }

  /** Idempotent activation for delayed jobs. */
  async processActivateJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "scheduled" || a.startTime > now) return;
    await lots.updateStatus(lotId, "active");
    if (a.auctionType === "dutch") {
      await lots.setDutchLastDecrementAt(a.id, now);
    }
    await this.notifyWatchlistStarting(a);
    await this.onLotActivated?.(lotId);
  }

  /** Idempotent end for delayed jobs. */
  async processEndJob(lotId: string, now: Date = new Date()): Promise<void> {
    const lots = this.repos.root.lot;
    const a = await lots.findById(lotId);
    if (!a || a.status !== "active" || a.endTime > now) return;
    await this.finalizeLotEnding(a, now);
  }
}
