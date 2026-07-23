import type {
  IAntiShillingGuard,
  ILegalEntityRepository,
  IRepositoryFactory,
  ISaleModeLookup,
  ISaleRepository,
  ISaleroomSessionLookup,
} from "@auction/persistence/interfaces";
import type { Bid } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "./bid-error.js";
import {
  type BidPolicyConfig,
  DEFAULT_BID_POLICY,
  type LotJobSchedulerPort,
} from "./bid-policy.js";
import { BidCriticalNotificationStager } from "./bid/bid-critical-notification.stager.js";
import { BidNotificationCoordinator } from "./bid/bid-notification.coordinator.js";
import { BidPrePlacementValidator } from "./bid/bid-pre-placement.validator.js";
import { EarlyCloseHandler } from "./bid/early-close.handler.js";
import { IdempotentBidExecutor } from "./bid/idempotent-bid.executor.js";
import type { PlaceBidWithIdempotencyOutcome } from "./bid/place-bid-idempotency.js";
import {
  type PlaceBidPipelineDeps,
  type PlaceBidTxOutcome,
  notifyAfterBidCommitted,
  runPlaceBidInTransaction,
} from "./bid/place-bid-pipeline.js";
import {
  ProxyAutoBidResolver,
  type ProxyCancelNotification,
} from "./bid/proxy-auto-bid.resolver.js";
import { SaleroomBidGate } from "./bid/saleroom-bid.gate.js";
import type { SaleroomOnBlockPolicy } from "./bid/saleroom-on-block.policy.js";
import { isPgUniqueViolation } from "./pg-unique-violation.js";
import type {
  IAdminMetricsService,
  IBidEligibility,
  IBidPlacerWithIdempotency,
  ICacheProvider,
  IDomainEventSink,
  IIdempotencyStore,
  ILotEarlyCloseLifecycleRecorder,
  ILotStrategyFactory,
  INotificationFactory,
  INotificationOutboxService,
  INotificationSender,
  PlaceBidInput,
  PlaceBidWithIdempotencyInput,
} from "./ports.js";

export type { PlaceBidWithIdempotencyOutcome } from "./bid/place-bid-idempotency.js";
export type { LotJobSchedulerPort } from "./bid-policy.js";

export type BidServiceOptions = {
  repos: IRepositoryFactory;
  strategyFactory: ILotStrategyFactory;
  cache: ICacheProvider;
  notifications: INotificationSender;
  lotJobs: LotJobSchedulerPort | null;
  adminMetrics?: IAdminMetricsService | null;
  saleModeLookup?: ISaleModeLookup | null;
  saleroomSessionLookup?: ISaleroomSessionLookup | null;
  saleroomOnBlockPolicy?: SaleroomOnBlockPolicy | null;
  antiShillingGuard?: IAntiShillingGuard | null;
  domainEventSink?: IDomainEventSink | null;
  legalEntityRepository?: ILegalEntityRepository | null;
  idempotencyStore?: IIdempotencyStore | null;
  bidEligibility?: IBidEligibility | null;
  englishOnlyAuctions?: boolean;
  lotLifecycleRecording?: ILotEarlyCloseLifecycleRecorder | null;
  bidPolicy?: BidPolicyConfig;
  notificationOutbox?: INotificationOutboxService | null;
  notificationFactory: INotificationFactory;
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
  private readonly domainEventSink: IDomainEventSink | null;

  constructor(opts: BidServiceOptions) {
    this.repos = opts.repos;
    this.strategyFactory = opts.strategyFactory;
    this.bidPolicy = opts.bidPolicy ?? DEFAULT_BID_POLICY;
    this.englishOnlyAuctions = opts.englishOnlyAuctions ?? false;
    this.legalEntityRepository = opts.legalEntityRepository ?? null;
    this.saleroomSessionLookup = opts.saleroomSessionLookup ?? null;
    this.antiShillingGuard = opts.antiShillingGuard ?? null;
    this.domainEventSink = opts.domainEventSink ?? null;

    const notificationFactory = opts.notificationFactory;

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
      domainEventSink: this.domainEventSink,
    };
  }

  async placeBid(input: PlaceBidInput): Promise<Result<Bid, BidError>> {
    try {
      if (input.internalPlacementKey?.trim()) {
        const existing = await this.repos.root.bid.findByInternalPlacementKey(
          input.internalPlacementKey.trim(),
        );
        if (existing) {
          return ok(existing);
        }
      }

      const preCheck = await this.prePlacementValidator.validate(input);
      if (preCheck.isErr()) {
        return err(preCheck.error);
      }

      const pendingProxyCancels: ProxyCancelNotification[] = [];
      const pipelineDeps = this.placeBidPipelineDeps();
      let txOutcome: PlaceBidTxOutcome & { prevWinnerId: string | null };
      try {
        txOutcome = await this.repos.runInTransaction(async ({ lot: lots, bid: bids }, tx) =>
          runPlaceBidInTransaction(pipelineDeps, { ...input, pendingProxyCancels }, lots, bids, tx),
        );
      } catch (e) {
        const placementKey = input.internalPlacementKey?.trim();
        if (placementKey && isPgUniqueViolation(e)) {
          const existing = await this.repos.root.bid.findByInternalPlacementKey(placementKey);
          if (existing) {
            return ok(existing);
          }
        }
        if (e instanceof BidError) {
          return err(e);
        }
        throw e;
      }

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
