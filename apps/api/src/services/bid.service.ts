import type { Database } from "@auction/db";
import type { Bid, Lot } from "@auction/types";
import { moneyGte, saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { AdminMetricsService } from "./admin-metrics.service.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import { IDEMPOTENCY_PENDING_VALUE } from "./interfaces/idempotency-store.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { IBidPlacer, PlaceBidInput } from "./interfaces/place-bid.js";
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

function defaultAutoBidStepMin(lot: Lot): number {
  const stepMin = lot.autoBidStepMin ? Number.parseFloat(lot.autoBidStepMin) : Number.NaN;
  const lotMin = minIncrementAmount(lot);
  return Number.isFinite(stepMin) && stepMin > 0 ? Math.max(lotMin, stepMin) : lotMin;
}

function effectiveBidderStep(lot: Lot, autoBidStepAmount: number | null | undefined): number {
  const lotMin = minIncrementAmount(lot);
  const step =
    autoBidStepAmount != null && Number.isFinite(autoBidStepAmount) && autoBidStepAmount > 0
      ? autoBidStepAmount
      : defaultAutoBidStepMin(lot);
  return Math.max(lotMin, step);
}

export type LotJobSchedulerPort = {
  rescheduleEnd(lotId: string, endTime: Date): Promise<void>;
  cancelLotJobs(lotId: string): Promise<void>;
};

export type PlaceBidWithIdempotencyOutcome =
  | { type: "replay"; body: { data: Bid } }
  | { type: "err"; error: BidError }
  | { type: "ok"; body: { data: Bid } };

export type BidServiceOptions = {
  repos: IRepositoryFactory;
  strategyFactory: ILotStrategyFactory;
  cache: ICacheProvider;
  notifications: NotificationService;
  notificationDispatcher: NotificationDispatcher | null;
  lotJobs: LotJobSchedulerPort | null;
  adminMetrics?: AdminMetricsService | null;
  saleModeLookup?: ISaleModeLookup | null;
  antiShillingGuard?: IAntiShillingGuard | null;
  domainEventPublisher?: DomainEventPublisher | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  idempotencyStore?: IIdempotencyStore | null;
  bidEligibility?: IBidEligibility | null;
  englishOnlyAuctions?: boolean;
};

export class BidService implements IBidPlacer {
  private readonly repos: IRepositoryFactory;
  private readonly strategyFactory: ILotStrategyFactory;
  private readonly cache: ICacheProvider;
  private readonly notifications: NotificationService;
  private readonly notificationDispatcher: NotificationDispatcher | null;
  private readonly lotJobs: LotJobSchedulerPort | null;
  private readonly adminMetrics: AdminMetricsService | null;
  private readonly saleModeLookup: ISaleModeLookup | null;
  private readonly antiShillingGuard: IAntiShillingGuard | null;
  private readonly domainEventPublisher: DomainEventPublisher | null;
  private readonly legalEntityRepository: ILegalEntityRepository | null;
  private readonly idempotencyStore: IIdempotencyStore | null;
  private readonly bidEligibility: IBidEligibility | null;
  private readonly englishOnlyAuctions: boolean;

  constructor(opts: BidServiceOptions) {
    this.repos = opts.repos;
    this.strategyFactory = opts.strategyFactory;
    this.cache = opts.cache;
    this.notifications = opts.notifications;
    this.notificationDispatcher = opts.notificationDispatcher;
    this.lotJobs = opts.lotJobs;
    this.adminMetrics = opts.adminMetrics ?? null;
    this.saleModeLookup = opts.saleModeLookup ?? null;
    this.antiShillingGuard = opts.antiShillingGuard ?? null;
    this.domainEventPublisher = opts.domainEventPublisher ?? null;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.idempotencyStore = opts.idempotencyStore ?? null;
    this.bidEligibility = opts.bidEligibility ?? null;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
  }

  async placeBid(input: PlaceBidInput): Promise<Result<Bid, BidError>> {
    const {
      placedByUserId,
      buyerLegalEntityId,
      lotId,
      amount,
      maxAutoBidAmount,
      autoBidStepAmount,
      placement: bidPlacement,
    } = input;
    try {
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
      if (this.bidEligibility) {
        const elig = await this.bidEligibility.assertCanPlaceBid({
          placedByUserId,
          buyerLegalEntityId,
          lotId,
          amount,
          ...(maxAutoBidAmount !== undefined ? { maxAutoBidAmount } : {}),
          ...(autoBidStepAmount !== undefined ? { autoBidStepAmount } : {}),
        });
        if (elig.isErr()) {
          return err(elig.error);
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
            this.englishOnlyAuctions &&
            lotRow.auctionType !== "english" &&
            lotRow.auctionType !== "buy_it_now"
          ) {
            throw new BidError(
              "Self-service bidding is only available for English and buy-now lots while English-only mode is enabled.",
              400,
              "english_only_catalogue",
            );
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
          const hasStep =
            hasMax &&
            autoBidStepAmount !== undefined &&
            Number.isFinite(autoBidStepAmount) &&
            autoBidStepAmount > 0;
          const stepStr = hasStep ? autoBidStepAmount.toFixed(2) : null;

          let lastBid = await bids.create({
            lotId,
            placedByUserId,
            buyerLegalEntityId,
            amount: amountStr,
            isWinning: false,
            isAutoBid: hasMax,
            maxAutoBidAmount: maxStr,
            autoBidStepAmount: stepStr,
            ...(bidPlacement?.placedVia != null ? { placedVia: bidPlacement.placedVia } : {}),
            ...(bidPlacement?.telephoneBookingId != null
              ? { telephoneBookingId: bidPlacement.telephoneBookingId }
              : {}),
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
        void this.notifications.notifyProxyCancelled(lotId, s.bidderId, "anti_shilling_violation");
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
    _minInc: number,
    tx: Database,
  ): Promise<Bid> {
    let lastBid = initialBid;
    let currentPrice = Number(lastBid.amount);
    let winnerId = lastBid.placedByUserId ?? lastBid.bidderId ?? null;
    if (!winnerId) return lastBid;

    for (let round = 0; round < MAX_PROXY_ROUNDS; round++) {
      const states = await bids.listBidderCeilingStates(lotId);
      type Cand = {
        bidderId: string;
        ceiling: number;
        buyerLegalEntityId: string;
        autoBidStepAmount: number | null;
      };
      const candidates: Cand[] = [];
      for (const s of states) {
        if (s.bidderId === winnerId) continue;
        const bidderStep = effectiveBidderStep(lot, s.autoBidStepAmount);
        if (this.antiShillingGuard) {
          const shill = await this.antiShillingGuard.violatesAntiShilling({
            bidderUserId: s.bidderId,
            buyerLegalEntityId: s.buyerLegalEntityId,
            lot,
          });
          if (shill) {
            if (await bids.bidderHasProxyMaxOnLot(lotId, s.bidderId)) {
              await bids.clearProxyAutoBidForBidderOnLot(lotId, s.bidderId);
              void this.notifications.notifyProxyCancelled(
                lotId,
                s.bidderId,
                "anti_shilling_violation",
              );
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
        if (s.ceiling >= currentPrice + bidderStep - 1e-9) {
          candidates.push({
            bidderId: s.bidderId,
            ceiling: s.ceiling,
            buyerLegalEntityId: s.buyerLegalEntityId,
            autoBidStepAmount: s.autoBidStepAmount,
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
      const raiseBy = effectiveBidderStep(lot, challenger.autoBidStepAmount);
      const nextAmt = Math.min(challenger.ceiling, currentPrice + raiseBy);
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
        autoBidStepAmount: raiseBy.toFixed(2),
        placedVia: null,
        telephoneBookingId: null,
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

  /**
   * Buyer bid placement with optional idempotency replay (Redis). Uses
   * `buyerLegalEntityId` when provided (acting entity header); otherwise falls
   * back to the user's personal entity.
   */
  async placeBidWithIdempotency(input: {
    placedByUserId: string;
    /** From `X-Legal-Entity-Id` / submissions legal-entity middleware. */
    buyerLegalEntityId?: string;
    idempotencyKey?: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
    autoBidStepAmount?: number;
    placedVia?: string;
    telephoneBookingId?: string;
  }): Promise<PlaceBidWithIdempotencyOutcome> {
    const { placedByUserId, idempotencyKey, lotId, amount, maxAutoBidAmount } = input;
    const idempotencyTtlSec = 86_400;
    let idempotencyRedisKey: string | undefined;

    if (idempotencyKey && this.idempotencyStore) {
      idempotencyRedisKey = `idempotency:bid:${placedByUserId}:${idempotencyKey}`;
      const replay = await this.readIdempotencyReplay(idempotencyRedisKey);
      if (replay) return replay;

      const claimed = await this.idempotencyStore.tryClaim(idempotencyRedisKey, idempotencyTtlSec);
      if (!claimed) {
        const waited = await this.waitForIdempotencyReplay(idempotencyRedisKey);
        if (waited) return waited;
      }
    }
    if (!this.legalEntityRepository) {
      if (idempotencyRedisKey && this.idempotencyStore) {
        await this.idempotencyStore.delete(idempotencyRedisKey);
      }
      return { type: "err", error: new BidError("Bid placement is not configured", 503) };
    }
    let buyerLegalEntityId = input.buyerLegalEntityId?.trim();
    if (!buyerLegalEntityId) {
      const buyerEntity = await this.legalEntityRepository.ensurePersonalEntity(placedByUserId);
      buyerLegalEntityId = buyerEntity.id;
    }
    const placement =
      input.placedVia != null || input.telephoneBookingId != null
        ? {
            ...(input.placedVia != null ? { placedVia: input.placedVia } : {}),
            ...(input.telephoneBookingId != null
              ? { telephoneBookingId: input.telephoneBookingId }
              : {}),
          }
        : undefined;
    const result = await this.placeBid({
      placedByUserId,
      buyerLegalEntityId,
      lotId,
      amount,
      ...(maxAutoBidAmount !== undefined ? { maxAutoBidAmount } : {}),
      ...(input.autoBidStepAmount !== undefined
        ? { autoBidStepAmount: input.autoBidStepAmount }
        : {}),
      ...(placement !== undefined ? { placement } : {}),
    });
    if (result.isErr()) {
      if (idempotencyRedisKey && this.idempotencyStore) {
        await this.idempotencyStore.delete(idempotencyRedisKey);
      }
      return { type: "err", error: result.error };
    }
    const bid = result.value;
    const body = { data: bid };
    if (idempotencyRedisKey && this.idempotencyStore) {
      await this.idempotencyStore.setWithExpiry(
        idempotencyRedisKey,
        JSON.stringify(body),
        idempotencyTtlSec,
      );
    }
    return { type: "ok", body };
  }

  private async readIdempotencyReplay(
    key: string,
  ): Promise<Extract<PlaceBidWithIdempotencyOutcome, { type: "replay" }> | null> {
    if (!this.idempotencyStore) return null;
    const cached = await this.idempotencyStore.get(key);
    if (!cached || cached === IDEMPOTENCY_PENDING_VALUE) return null;
    return { type: "replay", body: JSON.parse(cached) as { data: Bid } };
  }

  private async waitForIdempotencyReplay(
    key: string,
  ): Promise<PlaceBidWithIdempotencyOutcome | null> {
    if (!this.idempotencyStore) return null;
    for (let i = 0; i < 50; i++) {
      const replay = await this.readIdempotencyReplay(key);
      if (replay) return replay;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return {
      type: "err",
      error: new BidError("Bid still processing; retry shortly", 409, "bid_in_flight"),
    };
  }
}
