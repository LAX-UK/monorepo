import type { Database } from "@auction/db";
import { DrizzleSaleroomSessionRepository } from "@auction/persistence";
import type { Env } from "../env.js";
import { RedisIdempotencyStore } from "../infrastructure/redis-idempotency.store.js";
import { RedisSaleroomRealtimePublisher } from "../infrastructure/redis-saleroom-realtime.publisher.js";
import { DisplayTokenIssuer } from "../lib/display-token.js";
import { AbsenteeBidService } from "../services/absentee-bid.service.js";
import { AdminSaleOperationsSnapshotService } from "../services/admin-sale-operations-snapshot.service.js";
import { AutoBidService } from "../services/auto-bid.service.js";
import { BidService } from "../services/bid.service.js";
import { DEFAULT_BID_POLICY } from "../services/bid/bid-policy.js";
import { SaleroomOnBlockPolicy } from "../services/bid/saleroom-on-block.policy.js";
import { DisplayOverlayService } from "../services/display-overlay.service.js";
import { DisplayPairingService } from "../services/display-pairing.service.js";
import { DisplaySnapshotReader } from "../services/display-snapshot-reader.service.js";
import type { IDisplayOverlayService } from "../services/interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../services/interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "../services/interfaces/display-snapshot-reader.js";
import { SaleRegistrationService } from "../services/sale-registration.service.js";
import { SaleroomService } from "../services/saleroom.service.js";
import { createBidEligibility } from "./create-bid-eligibility.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerBiddingSaleroom = {
  saleRegistrationService: SaleRegistrationService;
  bidService: BidService;
  absenteeBidService: AbsenteeBidService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  autoBidService: AutoBidService;
  saleroomService: SaleroomService;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  displaySnapshotReader: IDisplaySnapshotReader;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
};

export type CreateBiddingSaleroomInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  lotLifecycle: ContainerLotLifecycle;
  complianceMedia: ContainerComplianceMedia;
  catalog: ContainerCatalogServices;
  payments: ContainerPaymentsServices;
};

export function createBiddingSaleroom(input: CreateBiddingSaleroomInput): ContainerBiddingSaleroom {
  const { env, db, infra, repos, platform, lotLifecycle, complianceMedia, catalog, payments } =
    input;
  const { redis, cache } = infra;
  const {
    legalEntityRepository,
    amlHoldStore,
    repoFactory,
    saleModeLookup,
    saleroomSessionLookup,
    antiShillingGuard,
    saleRepo,
    lotRepo,
    displayPairingRepository,
  } = repos;
  const {
    notificationService,
    domainEventPublisher,
    lotLifecycleRecording,
    notificationOutboxService,
    notificationFactory,
    strategyFactory,
  } = platform;
  const { lotLifecycleService, lotLifecycleHooks } = lotLifecycle;
  const { kycService, mediaUrlResolver } = complianceMedia;
  const { lotJobScheduler, telephoneBidBookingService } = catalog;
  const { adminMetricsService } = payments;

  const saleRegistrationService = new SaleRegistrationService(db, legalEntityRepository, saleRepo);
  const bidEligibilityService = createBidEligibility({ db, kycService, amlHoldStore });

  const bidIdempotencyStore = new RedisIdempotencyStore(redis);
  const saleroomOnBlockPolicy = new SaleroomOnBlockPolicy(db);
  const bidService = new BidService({
    repos: repoFactory,
    strategyFactory,
    cache,
    notifications: notificationService,
    lotJobs: lotJobScheduler,
    adminMetrics: adminMetricsService,
    saleModeLookup,
    saleroomSessionLookup,
    saleroomOnBlockPolicy,
    antiShillingGuard,
    domainEventPublisher,
    legalEntityRepository,
    idempotencyStore: bidIdempotencyStore,
    bidEligibility: bidEligibilityService,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    lotLifecycleRecording,
    bidPolicy: {
      ...DEFAULT_BID_POLICY,
      antiSnipingWindowMs: env.ANTI_SNIPING_WINDOW_MS,
      antiSnipingExtensionMs: env.ANTI_SNIPING_EXTENSION_MS,
    },
    notificationOutbox: notificationOutboxService,
    notificationFactory,
    saleRepo,
  });
  const absenteeBidService = new AbsenteeBidService(
    repos.absenteeBidRepository,
    bidService,
    lotRepo,
    legalEntityRepository,
  );
  const adminSaleOperationsSnapshotService = new AdminSaleOperationsSnapshotService(
    repos.adminSaleOperationsSnapshotReader,
    saleRegistrationService,
    telephoneBidBookingService,
  );
  const autoBidService = new AutoBidService({
    repos: repoFactory,
    bidPlacer: bidService,
    bidPlacerWithIdempotency: bidService,
    bidEligibility: bidEligibilityService,
    legalEntityRepository,
    notifications: notificationService,
  });
  lotLifecycleHooks.onLotActivated = (lotId) => absenteeBidService.replayScheduledForLot(lotId);
  const displayTokenIssuer = new DisplayTokenIssuer();
  const saleroomRealtimePublisher = new RedisSaleroomRealtimePublisher(redis);
  const saleroomSessionRepo = new DrizzleSaleroomSessionRepository(db);
  const saleroomService = new SaleroomService({
    sessionRepo: saleroomSessionRepo,
    redis,
    lotLifecycle: lotLifecycleService,
    saleRepo,
    lotRepo,
    lotJobs: lotJobScheduler,
    telephoneBidBookingService,
    displayPublisher: saleroomRealtimePublisher,
  });
  const displayPairingService = new DisplayPairingService({
    pairingRepo: displayPairingRepository,
    saleRepo,
    tokenIssuer: displayTokenIssuer,
    redis,
    domainEvents: domainEventPublisher,
    db,
  });
  const displayOverlayService = new DisplayOverlayService({
    db,
    saleroomDisplaySessionRepo: repos.saleroomDisplaySessionRepository,
    publisher: saleroomRealtimePublisher,
    domainEvents: domainEventPublisher,
  });
  const displaySnapshotReader = new DisplaySnapshotReader({
    reader: repos.saleroomDisplaySnapshotReader,
    mediaUrlResolver,
  });
  return {
    saleRegistrationService,
    bidService,
    absenteeBidService,
    adminSaleOperationsSnapshotService,
    autoBidService,
    saleroomService,
    displayPairingService,
    displayOverlayService,
    displaySnapshotReader,
    saleroomOnBlockPolicy,
  };
}
