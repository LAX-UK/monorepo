import type { Bid, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { AdminMetricsService } from "./admin-metrics.service.js";
import { BidCriticalNotificationStager } from "./bid/bid-critical-notification.stager.js";
import { numberToMoneyString } from "./bid/bid-money.js";
import { BidNotificationCoordinator } from "./bid/bid-notification.coordinator.js";
import {
  type BidPolicyConfig,
  DEFAULT_BID_POLICY,
  type LotJobSchedulerPort,
} from "./bid/bid-policy.js";
import { BidPrePlacementValidator } from "./bid/bid-pre-placement.validator.js";
import { EarlyCloseHandler } from "./bid/early-close.handler.js";
import { IdempotentBidExecutor } from "./bid/idempotent-bid.executor.js";
import type { PlaceBidWithIdempotencyOutcome } from "./bid/place-bid-idempotency.js";
import {
  ProxyAutoBidResolver,
  type ProxyCancelNotification,
} from "./bid/proxy-auto-bid.resolver.js";
import { SaleroomBidGate } from "./bid/saleroom-bid.gate.js";
import type { SaleroomOnBlockPolicy } from "./bid/saleroom-on-block.policy.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IAntiShillingGuard } from "./interfaces/anti-shilling.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type {
  IBidPlacerWithIdempotency,
  PlaceBidInput,
  PlaceBidWithIdempotencyInput,
} from "./interfaces/place-bid.js";
import type { ISaleRepository } from "./interfaces/repositories.js";
import type { IRepositoryFactory } from "./interfaces/repository-factory.js";
import type { ISaleModeLookup } from "./interfaces/sale-mode-lookup.js";
import type { ISaleroomSessionLookup } from "./interfaces/saleroom-session-lookup.js";
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
  saleroomOnBlockPolicy?: SaleroomOnBlockPolicy | null;
  antiShillingGuard?: IAntiShillingGuard | null;
  domainEventPublisher?: DomainEventPublisher | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  idempotencyStore?: IIdempotencyStore | null;
  bidEligibility?: IBidEligibility | null;
  englishOnlyAuctions?: boolean;
  lotLifecycleRecording?: ILotLifecycleRecorder | null;
  bidPolicy?: BidPolicyConfig;
  notificationOutbox?: INotificationOutboxService | null;
  notificationFactory?: NotificationFactory;
  saleRepo?: ISaleRepository | null;
};

export class BidService implements IBidPlacerWithIdempotency {
  private readonly repos: IRepositoryFactory;
  private readonly strategyFactory: ILotStrategyFactory;
  private readonly prePlacementValidator: BidPrePlacementValidator;
  private readonly saleroomBidGate: SaleroomBidGate;
  private readonly notificationCoordinator: BidNotificationCoordinator;
  private readonly criticalNotificationStager: BidCriticalNotificationStager;
  private readonly proxyResolver: ProxyAutoBidResolver;
  private readonly earlyCloseHandler: EarlyCloseHandler;
  private readonly idempotentExecutor: IdempotentBidExecutor;
  private readonly saleroomSessionLookup: ISaleroomSessionLookup | null;
  private readonly antiShillingGuard: IAntiShillingGuard | null;
  private readonly englishOnlyAuctions: boolean;
  private readonly legalEntityRepository: ILegalEntityRepository | null;
  private readonly bidPolicy: BidPolicyConfig;

  constructor(opts: BidServiceOptions) {
    this.repos = opts.repos;
    this.strategyFactory = opts.strategyFactory;
    this.bidPolicy = opts.bidPolicy ?? DEFAULT_BID_POLICY;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.saleroomSessionLookup = opts.saleroomSessionLookup ?? null;
    this.antiShillingGuard = opts.antiShillingGuard ?? null;

    const notificationFactory = opts.notificationFactory ?? new NotificationFactory();

    this.prePlacementValidator = new BidPrePlacementValidator(
      opts.saleModeLookup ?? null,
      opts.legalEntityRepository ?? null,
      opts.bidEligibility ?? null,
    );
    this.saleroomBidGate = new SaleroomBidGate(
      opts.saleroomSessionLookup ?? null,
      opts.saleroomOnBlockPolicy ?? null,
    );
    this.criticalNotificationStager = new BidCriticalNotificationStager(
      opts.notificationOutbox ?? null,
      notificationFactory,
      opts.saleRepo ?? null,
    );

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
      const preCheck = await this.prePlacementValidator.validate(input);
      if (preCheck.isErr()) {
        return err(preCheck.error);
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

          const skipCatalogEndTime =
            this.saleroomSessionLookup != null &&
            (await this.saleroomSessionLookup.shouldSkipAntiSnipeForLot(lotId));
          if (!skipCatalogEndTime && Date.now() > lotRow.endTime.getTime()) {
            throw new BidError("Lot has ended", 400);
          }

          const onBlock = await this.saleroomBidGate.assertCanBidOnLot({
            lotId,
            saleId: lotRow.saleId,
            tx,
          });
          if (onBlock.isErr()) {
            throw onBlock.error;
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

          await this.criticalNotificationStager.stageInTransaction({
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

      const updatedLot: Lot = endedEarly
        ? {
            ...lot,
            endTime: nextEnd,
            currentPrice: created.amount,
            status: "ended",
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
    input: PlaceBidWithIdempotencyInput,
  ): Promise<PlaceBidWithIdempotencyOutcome> {
    return this.idempotentExecutor.placeBidWithIdempotency(input);
  }
}
