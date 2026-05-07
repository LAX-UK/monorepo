import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { moneyGte, saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { AdminMetricsService } from "./admin-metrics.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IBidRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleModeLookup } from "./interfaces/sale-mode-lookup.js";
import { notificationRowToPayload } from "./notification-payload.js";
import type { NotificationDispatcher } from "./notification.dispatcher.js";
import { NotificationFactory } from "./notification.factory.js";
import type { NotificationService } from "./notification.service.js";

const ANTI_SNIPING_EXTENSION_MS = 30_000;
const MAX_PROXY_ROUNDS = 100;

function minIncrementAmount(lot: Lot): number {
  const n = Number.parseFloat(lot.minBidIncrement);
  return Number.isFinite(n) && n > 0 ? n : 0.01;
}

export type LotJobSchedulerPort = {
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
};

export class BidService {
  constructor(
    private readonly repos: IRepositoryFactory,
    private readonly strategyFactory: ILotStrategyFactory,
    private readonly cache: ICacheProvider,
    private readonly notifications: NotificationService,
    private readonly notificationDispatcher: NotificationDispatcher | null,
    private readonly lotJobs: LotJobSchedulerPort | null,
    private readonly adminMetrics: AdminMetricsService | null = null,
    private readonly saleModeLookup: ISaleModeLookup | null = null,
    private readonly antiShillingGuard: IAntiShillingGuard | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
    private readonly legalEntityRepository: ILegalEntityRepository | null = null,
  ) {}

  async placeBid(
    placedByUserId: string,
    buyerLegalEntityIdOrLotId: string,
    lotIdOrAmount: string | number,
    amountOrMaxAutoBidAmount?: number,
    maybeMaxAutoBidAmount?: number,
  ): Promise<Result<Bid, BidError>> {
    try {
      const legacyCall = typeof lotIdOrAmount === "number";
      const buyerLegalEntityId = legacyCall ? placedByUserId : buyerLegalEntityIdOrLotId;
      const lotId = legacyCall ? buyerLegalEntityIdOrLotId : lotIdOrAmount;
      const amount = legacyCall ? lotIdOrAmount : amountOrMaxAutoBidAmount;
      const maxAutoBidAmount = legacyCall ? amountOrMaxAutoBidAmount : maybeMaxAutoBidAmount;
      if (typeof lotId !== "string" || typeof amount !== "number") {
        return err(new BidError("Invalid bid input", 400));
      }
      // Read-only mode gate: reject bids targeting lots whose parent sale is
      // marketing-only (onsite). Done outside the bid transaction so it stays
      // a fast deny-path that does not contend with `findByIdForUpdate`.
      if (this.saleModeLookup) {
        const saleMode = await this.saleModeLookup.findSaleModeForLot(lotId);
        if (saleMode && !saleModeAllowsBidding(saleMode)) {
          return err(new BidError("Lot is not accepting bids", 400));
        }
      }
      if (this.legalEntityRepository) {
        const ent = await this.legalEntityRepository.findById(buyerLegalEntityId);
        if (!ent) {
          return err(new BidError("Buyer legal entity not found", 404));
        }
        if (ent.status !== "approved" && ent.status !== "restricted") {
          return err(
            new BidError(
              "Buyer legal entity is not authorised to bid",
              403,
              "entity_not_authorised_to_bid",
            ),
          );
        }
      }
      let prevWinnerId: string | null = null;
      const { created, lot, nextEnd, endedEarly } = await this.repos.runInTransaction(
        async ({ lot: lots, bid: bids }, tx) => {
          const lotRow = await lots.findByIdForUpdate(lotId);
          if (!lotRow) {
            throw new BidError("Lot not found", 404);
          }
          if (lotRow.status !== "active") {
            throw new BidError("Lot is not accepting bids", 400);
          }
          if (Date.now() > lotRow.endTime.getTime()) {
            throw new BidError("Lot has ended", 400);
          }
          if (
            this.antiShillingGuard &&
            (await this.antiShillingGuard.violatesAntiShilling({
              bidderUserId: placedByUserId,
              buyerLegalEntityId,
              lot: lotRow,
            }))
          ) {
            throw new BidError("Seller cannot bid on own lot", 400);
          }

          const prevWinning = await bids.findWinningBid(lotId);
          prevWinnerId = prevWinning?.placedByUserId ?? null;

          const strategy = this.strategyFactory.create(lotRow.auctionType);
          const validation = strategy.validateBid(lotRow, {
            placedByUserId,
            buyerLegalEntityId,
            amount,
          });
          if (validation.isErr()) {
            throw validation.error;
          }

          const nextPrice = strategy.getNextPrice(lotRow, amount);
          const amountStr = nextPrice.toFixed(2);

          const hasMax =
            maxAutoBidAmount !== undefined &&
            Number.isFinite(maxAutoBidAmount) &&
            maxAutoBidAmount >= amount;
          const maxStr = hasMax ? maxAutoBidAmount.toFixed(2) : null;

          let lastBid = await bids.create({
            lotId,
            placedByUserId,
            buyerLegalEntityId,
            amount: amountStr,
            isWinning: false,
            isAutoBid: hasMax,
            maxAutoBidAmount: maxStr,
          });

          if (this.antiShillingGuard) {
            await this.cancelViolatingProxyBids(lotId, lotRow, bids, tx);
          }

          if (lotRow.auctionType === "english" || lotRow.auctionType === "buy_it_now") {
            lastBid = await this.runProxyAutoBids(
              bids,
              lotId,
              lotRow,
              lastBid,
              minIncrementAmount(lotRow),
              tx,
            );
          }

          await bids.markWinningBid(lotId, lastBid.id);
          if (lotRow.auctionType === "sealed") {
            await lots.updateCurrentPrice(lotId, lotRow.startingPrice);
          } else {
            await lots.updateCurrentPrice(lotId, lastBid.amount);
          }

          let nextEnd = lotRow.endTime;
          if (
            strategy.shouldExtendTime(lotRow, {
              placedByUserId,
              buyerLegalEntityId,
              amount: Number.parseFloat(amountStr),
            })
          ) {
            nextEnd = new Date(lotRow.endTime.getTime() + ANTI_SNIPING_EXTENSION_MS);
            await lots.updateEndTime(lotId, nextEnd);
          }

          let endedEarly = false;
          if (lotRow.auctionType === "dutch") {
            const winnerUserId = lastBid.placedByUserId ?? lastBid.bidderId;
            const winnerLegalEntityId = lastBid.buyerLegalEntityId ?? buyerLegalEntityId;
            if (!winnerUserId || !winnerLegalEntityId) {
              throw new BidError("Bid legal entity context missing", 400);
            }
            await lots.setWinner(lotId, winnerUserId, winnerLegalEntityId);
            await lots.updateStatus(lotId, "ended");
            endedEarly = true;
          } else if (lotRow.auctionType === "buy_it_now") {
            const bn =
              lotRow.buyNowPrice !== null && lotRow.buyNowPrice !== ""
                ? Number(lotRow.buyNowPrice)
                : null;
            if (
              bn !== null &&
              Number.isFinite(bn) &&
              lotRow.buyNowPrice !== null &&
              lotRow.buyNowPrice !== "" &&
              moneyGte(lastBid.amount, lotRow.buyNowPrice)
            ) {
              const winnerUserId = lastBid.placedByUserId ?? lastBid.bidderId;
              const winnerLegalEntityId = lastBid.buyerLegalEntityId ?? buyerLegalEntityId;
              if (!winnerUserId || !winnerLegalEntityId) {
                throw new BidError("Bid legal entity context missing", 400);
              }
              await lots.setWinner(lotId, winnerUserId, winnerLegalEntityId);
              await lots.updateStatus(lotId, "ended");
              endedEarly = true;
            }
          }

          return { created: lastBid, lot: lotRow, nextEnd, endedEarly };
        },
      );

      const displayPrice =
        lot.auctionType === "sealed" && !endedEarly ? lot.startingPrice : created.amount;
      const createdUserId = created.placedByUserId ?? created.bidderId ?? null;

      const updatedLot = endedEarly
        ? {
            ...lot,
            endTime: nextEnd,
            currentPrice: created.amount,
            status: "ended" as const,
            winnerId: createdUserId,
            ...(created.buyerLegalEntityId
              ? { buyerLegalEntityId: created.buyerLegalEntityId }
              : {}),
          }
        : nextEnd.getTime() !== lot.endTime.getTime()
          ? { ...lot, endTime: nextEnd, currentPrice: displayPrice }
          : { ...lot, currentPrice: displayPrice };

      await this.cache.set(`lot:${lotId}:currentPrice`, displayPrice, 3600);

      void this.adminMetrics?.recordBidPlaced();

      const outbidMeta =
        prevWinnerId && prevWinnerId !== created.placedByUserId
          ? { outbidUserId: prevWinnerId }
          : undefined;
      await this.notifications.notifyBidPlaced(updatedLot, created, outbidMeta);

      if (endedEarly) {
        await this.lotJobs?.cancelLotJobs(lotId);
        await this.notifications.notifyLotEnded(updatedLot, created);
      }

      if (nextEnd.getTime() !== lot.endTime.getTime() && !endedEarly) {
        await this.notifications.notifyLotExtended(updatedLot, nextEnd);
        await this.lotJobs?.rescheduleEnd(lotId, nextEnd);
      }

      if (this.notificationDispatcher && prevWinnerId && prevWinnerId !== created.placedByUserId) {
        const factory = new NotificationFactory();
        await this.notificationDispatcher.dispatch(
          prevWinnerId,
          notificationRowToPayload(factory.createOutbid(lot, prevWinnerId)),
        );
      }

      return ok(created);
    } catch (e) {
      if (e instanceof BidError) {
        return err(e);
      }
      throw e;
    }
  }

  private async cancelViolatingProxyBids(
    lotId: string,
    lotRow: Lot,
    bids: IBidRepository,
    tx: Database,
  ): Promise<void> {
    if (!this.antiShillingGuard) return;
    const states = await bids.listBidderCeilingStates(lotId);
    for (const s of states) {
      if (!(await bids.bidderHasProxyMaxOnLot(lotId, s.bidderId))) continue;
      if (
        await this.antiShillingGuard.violatesAntiShilling({
          bidderUserId: s.bidderId,
          buyerLegalEntityId: s.buyerLegalEntityId,
          lot: lotRow,
        })
      ) {
        await bids.clearProxyAutoBidForBidderOnLot(lotId, s.bidderId);
        if (this.domainEventPublisher) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "lot",
            aggregateId: lotId,
            eventType: "bid.proxy_cancelled",
            payload: {
              lotId,
              bidderUserId: s.bidderId,
              buyerLegalEntityId: s.buyerLegalEntityId,
              reason: "anti_shilling_violation",
            },
            actorUserId: null,
          });
        }
      }
    }
  }

  private async runProxyAutoBids(
    bids: IBidRepository,
    lotId: string,
    lot: Lot,
    initialBid: Bid,
    minInc: number,
    tx: Database,
  ): Promise<Bid> {
    let lastBid = initialBid;
    let currentPrice = Number(lastBid.amount);
    let winnerId = lastBid.placedByUserId ?? lastBid.bidderId ?? null;
    if (!winnerId) return lastBid;

    for (let round = 0; round < MAX_PROXY_ROUNDS; round++) {
      const states = await bids.listBidderCeilingStates(lotId);
      type Cand = { bidderId: string; ceiling: number; buyerLegalEntityId: string };
      const candidates: Cand[] = [];
      for (const s of states) {
        if (s.bidderId === winnerId) continue;
        if (this.antiShillingGuard) {
          const shill = await this.antiShillingGuard.violatesAntiShilling({
            bidderUserId: s.bidderId,
            buyerLegalEntityId: s.buyerLegalEntityId,
            lot,
          });
          if (shill) {
            if (await bids.bidderHasProxyMaxOnLot(lotId, s.bidderId)) {
              await bids.clearProxyAutoBidForBidderOnLot(lotId, s.bidderId);
              if (this.domainEventPublisher) {
                await this.domainEventPublisher.publish(tx, {
                  aggregateType: "lot",
                  aggregateId: lotId,
                  eventType: "bid.proxy_cancelled",
                  payload: {
                    lotId,
                    bidderUserId: s.bidderId,
                    buyerLegalEntityId: s.buyerLegalEntityId,
                    reason: "anti_shilling_violation",
                  },
                  actorUserId: null,
                });
              }
            }
            continue;
          }
        }
        if (s.ceiling >= currentPrice + minInc - 1e-9) {
          candidates.push({
            bidderId: s.bidderId,
            ceiling: s.ceiling,
            buyerLegalEntityId: s.buyerLegalEntityId,
          });
        }
      }
      if (candidates.length === 0) break;
      candidates.sort((a, b) => {
        if (b.ceiling !== a.ceiling) return b.ceiling - a.ceiling;
        return a.bidderId.localeCompare(b.bidderId);
      });
      const challenger = candidates[0];
      if (!challenger) break;
      const nextAmt = Math.min(challenger.ceiling, currentPrice + minInc);
      if (nextAmt <= currentPrice + 1e-9) break;

      const nextStr = nextAmt.toFixed(2);
      lastBid = await bids.create({
        lotId,
        placedByUserId: challenger.bidderId,
        buyerLegalEntityId: challenger.buyerLegalEntityId,
        amount: nextStr,
        isWinning: false,
        isAutoBid: true,
        maxAutoBidAmount: challenger.ceiling.toFixed(2),
      });
      currentPrice = nextAmt;
      winnerId = challenger.bidderId;
    }

    return lastBid;
  }

  /** Public bid history for a lot (newest first). */
  async listForLot(lotId: string, limit: number): Promise<Bid[]> {
    return this.repos.root.bid.listForLot(lotId, limit);
  }
}
