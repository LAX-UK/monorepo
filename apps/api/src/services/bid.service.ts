import type { IAntiShillingGuard } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ISaleRepository } from "@auction/persistence/interfaces";
import type { IRepositoryFactory } from "@auction/persistence/interfaces";
import type { ISaleModeLookup } from "@auction/persistence/interfaces";
import type { ISaleroomSessionLookup } from "@auction/persistence/interfaces";
import type { Bid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import type { AdminMetricsService } from "./admin-metrics.service.js";
import { BidCriticalNotificationStager } from "./bid/bid-critical-notification.stager.js";
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
  type PlaceBidPipelineDeps,
  notifyAfterBidCommitted,
  runPlaceBidInTransaction,
} from "./bid/place-bid-pipeline.js";
import {
  ProxyAutoBidResolver,
  type ProxyCancelNotification,
} from "./bid/proxy-auto-bid.resolver.js";
import { SaleroomBidGate } from "./bid/saleroom-bid.gate.js";
import type { SaleroomOnBlockPolicy } from "./bid/saleroom-on-block.policy.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { ILotStrategyFactory } from "./interfaces/auction-strategy.js";
import type { IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { ICacheProvider } from "./interfaces/cache.js";
import type { IIdempotencyStore } from "./interfaces/idempotency-store.js";
import type { ILotLifecycleRecorder } from "./interfaces/lot-lifecycle-recorder.js";
import type { INotificationOutboxService } from "./interfaces/notification-outbox.js";
import type {
  IBidPlacerWithIdempotency,
  PlaceBidInput,
  PlaceBidWithIdempotencyInput,
} from "./interfaces/place-bid.js";
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
  domainEventSink?: IDomainEventSink | null;
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
      opts.domainEventSink ?? null,
    );

    this.earlyCloseHandler = new EarlyCloseHandler(opts.lotLifecycleRecording ?? null);

    this.idempotentExecutor = new IdempotentBidExecutor(
      this,
      this.legalEntityRepository,
      opts.idempotencyStore ?? null,
    );
  }

  private placeBidPipelineDeps(): PlaceBidPipelineDeps {
    return {
      strategyFactory: this.strategyFactory,
      saleroomBidGate: this.saleroomBidGate,
      saleroomSessionLookup: this.saleroomSessionLookup,
      antiShillingGuard: this.antiShillingGuard,
      proxyResolver: this.proxyResolver,
      earlyCloseHandler: this.earlyCloseHandler,
      criticalNotificationStager: this.criticalNotificationStager,
      notificationCoordinator: this.notificationCoordinator,
      repos: this.repos,
      englishOnlyAuctions: this.englishOnlyAuctions,
      bidPolicy: this.bidPolicy,
    };
  }

  async placeBid(input: PlaceBidInput): Promise<Result<Bid, BidError>> {
    try {
      const preCheck = await this.prePlacementValidator.validate(input);
      if (preCheck.isErr()) {
        return err(preCheck.error);
      }

      const pendingProxyCancels: ProxyCancelNotification[] = [];
      const pipelineDeps = this.placeBidPipelineDeps();
      const txOutcome = await this.repos.runInTransaction(async ({ lot: lots, bid: bids }, tx) =>
        runPlaceBidInTransaction(pipelineDeps, { ...input, pendingProxyCancels }, lots, bids, tx),
      );

      await notifyAfterBidCommitted(pipelineDeps, input, txOutcome, pendingProxyCancels);

      return ok(txOutcome.created);
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
