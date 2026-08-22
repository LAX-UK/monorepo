import type { Database } from "@auction/db";
import { saleroomSession } from "@auction/db/schema";
import type { Bid, Lot } from "@auction/types";
import { saleModeAllowsBidding } from "@auction/validators";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { buyerEntityCanBid } from "../lib/buyer-entity-bid-eligibility.js";
import { BidError } from "../lib/errors.js";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import type { AdminMetricsService } from "./admin-metrics.service.js";
import { numberToMoneyString } from "./bid/bid-money.js";
import { BidNotificationCoordinator } from "./bid/bid-notification.coordinator.js";
import {
  type BidPolicyConfig,
  DEFAULT_BID_POLICY,
  type LotJobSchedulerPort,
} from "./bid/bid-policy.js";
import { EarlyCloseHandler } from "./bid/early-close.handler.js";
import { IdempotentBidExecutor } from "./bid/idempotent-bid.executor.js";
import type { PlaceBidWithIdempotencyOutcome } from "./bid/place-bid-idempotency.js";
import {
  ProxyAutoBidResolver,
  type ProxyCancelNotification,
} from "./bid/proxy-auto-bid.resolver.js";
import { StandingBidEligibilityValidator } from "./bid/standing-bid-eligibility.validator.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import { isOperatorPlacement } from "./interfaces/auction-strategy.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type { IBidPlacer, PlaceBidInput } from "./interfaces/place-bid.js";
import type { IBidRepository } from "./interfaces/repositories.js";
import type { ISaleRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleModeLookup } from "./interfaces/sale-mode-lookup.js";
import type { ISaleroomSessionLookup } from "./interfaces/saleroom-session-lookup.js";
import type { LotLifecycleRecording } from "./lot-lifecycle-recording.service.js";
import { notificationRowToPayload } from "./notification-payload.js";
import { NotificationFactory } from "./notification.factory.js";
import type { NotificationService } from "./notification.service.js";

export type { PlaceBidWithIdempotencyOutcome } from "./bid/place-bid-idempotency.js";
export type { LotJobSchedulerPort } from "./bid/bid-policy.js";

export type BidServiceOptions = {
  repos: IRepositoryFactory;
  strategyFactory: ILotStrategyFactory;
  cache: ICacheProvider;
  notifications: NotificationService;
  lotJobs: LotJobSchedulerPort | null;
  adminMetrics?: AdminMetricsService | null;
  saleModeLookup?: ISaleModeLookup | null;
  saleroomSessionLookup?: ISaleroomSessionLookup | null;
  antiShillingGuard?: IAntiShillingGuard | null;
  domainEventPublisher?: DomainEventPublisher | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  idempotencyStore?: IIdempotencyStore | null;
  bidEligibility?: IBidEligibility | null;
  englishOnlyAuctions?: boolean;
  lotLifecycleRecording?: LotLifecycleRecording | null;
  bidPolicy?: BidPolicyConfig;
  notificationOutbox?: INotificationOutboxService | null;
  notificationFactory?: NotificationFactory;
  saleRepo?: ISaleRepository | null;
};

export class BidService implements IBidPlacer {
  private readonly repos: IRepositoryFactory;
  private readonly strategyFactory: ILotStrategyFactory;
  private readonly notificationCoordinator: BidNotificationCoordinator;
  private readonly proxyResolver: ProxyAutoBidResolver;
  private readonly earlyCloseHandler: EarlyCloseHandler;
  private readonly idempotentExecutor: IdempotentBidExecutor;
  private readonly saleModeLookup: ISaleModeLookup | null;
  private readonly saleroomSessionLookup: ISaleroomSessionLookup | null;
  private readonly antiShillingGuard: IAntiShillingGuard | null;
  private readonly bidEligibility: IBidEligibility | null;
  private readonly englishOnlyAuctions: boolean;
  private readonly legalEntityRepository: ILegalEntityRepository | null;
  private readonly bidPolicy: BidPolicyConfig;
  private readonly notificationOutbox: INotificationOutboxService | null;
  private readonly notificationFactory: NotificationFactory;
  private readonly saleRepo: ISaleRepository | null;

  constructor(opts: BidServiceOptions) {
    this.repos = opts.repos;
    this.strategyFactory = opts.strategyFactory;
    this.bidPolicy = opts.bidPolicy ?? DEFAULT_BID_POLICY;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.saleModeLookup = opts.saleModeLookup ?? null;
    this.saleroomSessionLookup = opts.saleroomSessionLookup ?? null;
    this.antiShillingGuard = opts.antiShillingGuard ?? null;
    this.bidEligibility = opts.bidEligibility ?? null;
    this.notificationOutbox = opts.notificationOutbox ?? null;
    this.notificationFactory = opts.notificationFactory ?? new NotificationFactory();
    this.saleRepo = opts.saleRepo ?? null;

    this.notificationCoordinator = new BidNotificationCoordinator(
      opts.cache,
      opts.notifications,
      opts.lotJobs,
      opts.adminMetrics ?? null,
    );

    this.proxyResolver = new ProxyAutoBidResolver(
      opts.antiShillingGuard ?? null,
      opts.notifications,
      opts.domainEventPublisher ?? null,
      opts.bidEligibility && opts.legalEntityRepository
        ? new StandingBidEligibilityValidator(opts.bidEligibility, opts.legalEntityRepository)
        : null,
    );

    this.earlyCloseHandler = new EarlyCloseHandler(opts.lotLifecycleRecording ?? null);

    this.idempotentExecutor = new IdempotentBidExecutor(
      this,
      this.legalEntityRepository,
      opts.idempotencyStore ?? null,
    );
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
      if (this.saleModeLookup) {
        const saleMode = await this.saleModeLookup.findSaleModeForLot(lotId);
        const placedVia = bidPlacement?.placedVia ?? null;
        if (saleMode && !saleModeAllowsBidding(saleMode) && !isOperatorPlacement(placedVia)) {
          return err(new BidError("Lot is not accepting bids", 400));
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
          ...(bidPlacement?.placedVia != null ? { placedVia: bidPlacement.placedVia } : {}),
          ...(bidPlacement?.telephoneBookingId != null
            ? { telephoneBookingId: bidPlacement.telephoneBookingId }
            : {}),
          ...(bidPlacement?.saleId != null ? { saleId: bidPlacement.saleId } : {}),
          ...(bidPlacement?.paddleNumber != null
            ? { paddleNumber: bidPlacement.paddleNumber }
            : {}),
        });
        if (elig.isErr()) {
          return err(elig.error);
        }
      }
      if (this.legalEntityRepository) {
        const ent = await this.legalEntityRepository.findById(buyerLegalEntityId);
        if (!ent) {
          return err(new BidError("Buyer legal entity not found", 404));
        }
        if (!buyerEntityCanBid(ent.status)) {
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
      const pendingProxyCancels: ProxyCancelNotification[] = [];
      const { created, lot, nextEnd, endedEarly } = await this.repos.runInTransaction(
        async ({ lot: lots, bid: bids }, tx) => {
          const lotRow = await lots.findByIdForUpdate(lotId);
          if (!lotRow) {
            throw new BidError("Lot not found", 404);
          }
          if (lotRow.status !== "active") {
            throw new BidError("Lot is not accepting bids", 400);
          }
          const enforceOnBlock =
            this.saleroomSessionLookup != null &&
            (await this.saleroomSessionLookup.shouldEnforceOnBlockGateForLot(lotId));
          const skipCatalogEndTime =
            this.saleroomSessionLookup != null &&
            (await this.saleroomSessionLookup.shouldSkipAntiSnipeForLot(lotId));
          if (!skipCatalogEndTime && Date.now() > lotRow.endTime.getTime()) {
            throw new BidError("Lot has ended", 400);
          }

          if (enforceOnBlock && lotRow.saleId) {
            const [session] = await tx
              .select({
                status: saleroomSession.status,
                currentLotId: saleroomSession.currentLotId,
              })
              .from(saleroomSession)
              .where(eq(saleroomSession.saleId, lotRow.saleId))
              .limit(1);
            if (session?.status === "paused") {
              throw new BidError(
                "Saleroom is paused — bidding will resume shortly",
                400,
                "saleroom_paused",
              );
            }
            if (!session || session.status !== "live") {
              throw new BidError(
                "Saleroom is not live — bids can only be placed on the current lot",
                400,
                "lot_not_on_block",
              );
            }
            if (session.currentLotId !== lotId) {
              throw new BidError("This lot is not on the block", 400, "lot_not_on_block");
            }
          }

          const strategy = this.strategyFactory.create(lotRow.auctionType);
          const selfService = strategy.validateSelfServiceAllowed?.(
            lotRow,
            this.englishOnlyAuctions,
          );
          if (selfService?.isErr()) {
            throw selfService.error;
          }

          if (
            this.antiShillingGuard &&
            (await this.antiShillingGuard.violatesAntiShilling({
              bidderUserId: placedByUserId,
              buyerLegalEntityId,
              lot: lotRow,
            }))
          ) {
            throw new BidError("Seller cannot bid on own lot", 400, "seller_cannot_bid");
          }

          const prevWinning = await bids.findWinningBid(lotId);
          prevWinnerId = prevWinning?.placedByUserId ?? prevWinning?.bidderId ?? null;

          const validation = strategy.validateBid(
            lotRow,
            {
              placedByUserId,
              buyerLegalEntityId,
              amount,
              bidderId: placedByUserId,
            },
            {
              currentWinnerId: prevWinnerId,
              placedVia: bidPlacement?.placedVia ?? null,
            },
          );
          if (validation.isErr()) {
            throw validation.error;
          }

          const nextPrice = strategy.getNextPrice(lotRow, amount);
          const amountStr = numberToMoneyString(nextPrice);

          const hasMax =
            maxAutoBidAmount !== undefined &&
            Number.isFinite(maxAutoBidAmount) &&
            maxAutoBidAmount >= amount;
          const maxStr = hasMax ? numberToMoneyString(maxAutoBidAmount) : null;
          const hasStep =
            hasMax &&
            autoBidStepAmount !== undefined &&
            Number.isFinite(autoBidStepAmount) &&
            autoBidStepAmount > 0;
          const stepStr = hasStep ? numberToMoneyString(autoBidStepAmount) : null;

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
            ...(bidPlacement?.clerkUserId != null ? { clerkUserId: bidPlacement.clerkUserId } : {}),
          });

          if (this.antiShillingGuard) {
            await this.proxyResolver.cancelViolatingProxyBids(
              lotId,
              lotRow,
              bids,
              tx,
              pendingProxyCancels,
            );
          }

          if (lotRow.auctionType === "english" || lotRow.auctionType === "buy_it_now") {
            lastBid = await this.proxyResolver.resolve(
              bids,
              lotId,
              lotRow,
              lastBid,
              tx,
              pendingProxyCancels,
            );
          }

          await bids.markWinningBid(lotId, lastBid.id);
          if (lotRow.auctionType === "sealed") {
            await lots.updateCurrentPrice(lotId, lotRow.startingPrice);
          } else {
            await lots.updateCurrentPrice(lotId, lastBid.amount);
          }

          let nextEnd = lotRow.endTime;
          const skipAntiSnipe =
            this.saleroomSessionLookup != null &&
            (await this.saleroomSessionLookup.shouldSkipAntiSnipeForLot(lotId));
          if (
            !skipAntiSnipe &&
            strategy.shouldExtendTime(
              lotRow,
              {
                placedByUserId,
                buyerLegalEntityId,
                amount: nextPrice,
                bidderId: placedByUserId,
              },
              this.bidPolicy,
            )
          ) {
            nextEnd = new Date(lotRow.endTime.getTime() + this.bidPolicy.antiSnipingExtensionMs);
            await lots.updateEndTime(lotId, nextEnd);
          }

          const earlyClose = await this.earlyCloseHandler.tryEarlyClose({
            strategy,
            lots,
            lotRow,
            lastBid,
            buyerLegalEntityId,
            placedByUserId,
            tx,
          });
          const endedEarly = earlyClose != null;

          await this.stageCriticalBidNotificationsInTransaction({
            lotId,
            lotRow,
            created: lastBid,
            prevWinnerId,
            endedEarly,
            bids,
            tx,
          });

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

      await this.proxyResolver.flushPendingProxyCancels(pendingProxyCancels);

      await this.notificationCoordinator.afterBidCommitted({
        lotId,
        displayPrice,
        updatedLot,
        created,
        prevWinnerId,
        nextEnd,
        lotEndBefore: lot.endTime,
        endedEarly,
        bidCount: await this.repos.root.bid.countForLot(lotId),
      });

      return ok(created);
    } catch (e) {
      if (e instanceof BidError) {
        return err(e);
      }
      throw e;
    }
  }

  /** Public bid history for a lot (newest first). */
  async listForLot(lotId: string, limit: number): Promise<Bid[]> {
    return this.repos.root.bid.listForLot(lotId, limit);
  }

  async placeBidWithIdempotency(
    input: Parameters<IdempotentBidExecutor["placeBidWithIdempotency"]>[0],
  ): Promise<PlaceBidWithIdempotencyOutcome> {
    return this.idempotentExecutor.placeBidWithIdempotency(input);
  }

  private async stageCriticalBidNotificationsInTransaction(params: {
    lotId: string;
    lotRow: Lot;
    created: Bid;
    prevWinnerId: string | null;
    endedEarly: boolean;
    bids: IBidRepository;
    tx: Database;
  }): Promise<void> {
    if (!this.notificationOutbox) return;

    const createdUserId = params.created.placedByUserId ?? params.created.bidderId ?? null;
    if (!createdUserId) return;

    const lotForNotify: Lot = params.endedEarly
      ? {
          ...params.lotRow,
          status: "ended",
          endTime: params.lotRow.endTime,
          currentPrice: params.created.amount,
          winnerId: createdUserId,
          ...(params.created.buyerLegalEntityId
            ? { buyerLegalEntityId: params.created.buyerLegalEntityId }
            : {}),
        }
      : params.lotRow;

    if (params.prevWinnerId && params.prevWinnerId !== createdUserId) {
      await this.notificationOutbox.stageDispatch(
        {
          userId: params.prevWinnerId,
          payload: notificationRowToPayload(
            this.notificationFactory.createOutbid(lotForNotify, params.prevWinnerId),
          ),
          idempotencyKey: `outbid:${params.lotId}:${params.created.id}:${params.prevWinnerId}`,
        },
        params.tx,
      );
    }

    if (params.endedEarly) {
      const sale = lotForNotify.saleId ? await this.saleRepo?.findById(lotForNotify.saleId) : null;
      const pricing = computeLotCheckoutPricing(lotForNotify, sale ?? null);
      await this.notificationOutbox.stageDispatch(
        {
          userId: createdUserId,
          payload: notificationRowToPayload(
            this.notificationFactory.createWon(lotForNotify, createdUserId, {
              hammerPrice: pricing.hammerMajor,
              totalDue: pricing.totalMajor,
            }),
          ),
          idempotencyKey: `lot_won:${params.lotId}:${createdUserId}`,
        },
        params.tx,
      );

      const bidderIds = await params.bids.listDistinctBidderIds(params.lotId);
      for (const uid of bidderIds) {
        if (uid === createdUserId) continue;
        await this.notificationOutbox.stageDispatch(
          {
            userId: uid,
            payload: notificationRowToPayload(
              this.notificationFactory.createLost(lotForNotify, uid),
            ),
            idempotencyKey: `lot_lost:${params.lotId}:${uid}`,
          },
          params.tx,
        );
      }
    }
  }
}
