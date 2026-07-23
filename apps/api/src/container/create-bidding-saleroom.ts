import { SaleroomOnBlockPolicy, createBidPlacer } from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import { DrizzleSaleroomSessionRepository } from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { RedisIdempotencyStore } from "../infrastructure/redis-idempotency.store.js";
import { RedisSaleroomRealtimePublisher } from "../infrastructure/redis-saleroom-realtime.publisher.js";
import { DisplayTokenIssuer } from "../lib/display-token.js";
import { AbsenteeBidService } from "../services/absentee-bid.service.js";
import { AdminSaleOperationsSnapshotService } from "../services/admin-sale-operations-snapshot.service.js";
import { AutoBidService } from "../services/auto-bid.service.js";
import type { BidService } from "../services/bid.service.js";
import { DEFAULT_BID_POLICY } from "../services/bid/bid-policy.js";
import { DisplayOverlayService } from "../services/display-overlay.service.js";
import { DisplayPairingService } from "../services/display-pairing.service.js";
import { DisplaySnapshotReader } from "../services/display-snapshot-reader.service.js";
import type { IDisplayOverlayService } from "../services/interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../services/interfaces/display-pairing-service.js";
import type { IDisplaySnapshotReader } from "../services/interfaces/display-snapshot-reader.js";
import type { SaleroomServicePort } from "../services/interfaces/saleroom-service.js";
import { SaleRegistrationService } from "../services/sale-registration.service.js";
import { SaleroomService } from "../services/saleroom.service.js";
import { createBidEligibility } from "./create-bid-eligibility.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerBiddingSaleroom = {
  saleRegistrationService: SaleRegistrationService;
  bidService: BidService;
  absenteeBidService: AbsenteeBidService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  autoBidService: AutoBidService;
  saleroomService: SaleroomServicePort;
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
  adminMetricsService: import("../services/admin-metrics.service.js").AdminMetricsService;
};

/** Registration + bid placement stack (no session/display wiring). */
export type BiddingSaleroomRegistrationBidSlice = Pick<
  ContainerBiddingSaleroom,
  | "saleRegistrationService"
  | "bidService"
  | "absenteeBidService"
  | "autoBidService"
  | "adminSaleOperationsSnapshotService"
  | "saleroomOnBlockPolicy"
>;

/** Live session control + realtime publisher wiring. */
export type BiddingSaleroomSessionSlice = Pick<ContainerBiddingSaleroom, "saleroomService">;

/** Saleroom display pairing/overlay/read models. */
export type BiddingSaleroomDisplaySlice = Pick<
  ContainerBiddingSaleroom,
  "displayPairingService" | "displayOverlayService" | "displaySnapshotReader"
>;

function composeRegistrationAndBidding(
  input: CreateBiddingSaleroomInput,
): BiddingSaleroomRegistrationBidSlice {
  const {
    env,
    db,
    infra,
    repos,
    platform,
    lotLifecycle,
    complianceMedia,
    catalog,
    adminMetricsService,
  } = input;
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
  } = repos;
  const {
    notificationService,
    domainEventSink,
    lotLifecycleRecording,
    notificationOutboxService,
    notificationFactory,
    strategyFactory,
  } = platform;
  const { lotLifecycleHooks } = lotLifecycle;
  const { kycService } = complianceMedia;
  const { lotJobScheduler, telephoneBidBookingService } = catalog;

  const saleRegistrationService = new SaleRegistrationService(
    legalEntityRepository,
    saleRepo,
    repos.saleRegistrationRepository,
  );
  const bidEligibilityService = createBidEligibility({ db, kycService, amlHoldStore });

  const bidIdempotencyStore = new RedisIdempotencyStore(redis);
  const saleroomOnBlockPolicy = new SaleroomOnBlockPolicy(repos.saleroomOnBlockReader);
  const bidService = createBidPlacer({
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
    domainEventSink,
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
    repoFactory.root.bid,
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

  return {
    saleRegistrationService,
    bidService,
    absenteeBidService,
    adminSaleOperationsSnapshotService,
    autoBidService,
    saleroomOnBlockPolicy,
  };
}

function composeSaleroomSession(input: CreateBiddingSaleroomInput): BiddingSaleroomSessionSlice {
  const { db, infra, repos, lotLifecycle, catalog } = input;
  const { redis } = infra;
  const { saleRepo, lotRepo } = repos;
  const { lotLifecycleService } = lotLifecycle;
  const { lotJobScheduler, telephoneBidBookingService } = catalog;
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
  return { saleroomService };
}

function composeSaleroomDisplay(input: CreateBiddingSaleroomInput): BiddingSaleroomDisplaySlice {
  const { infra, repos, platform, complianceMedia } = input;
  const { redis } = infra;
  const { saleRepo, displayPairingRepository } = repos;
  const { domainEventSink } = platform;
  const { mediaUrlResolver } = complianceMedia;
  const displayTokenIssuer = new DisplayTokenIssuer();
  const saleroomRealtimePublisher = new RedisSaleroomRealtimePublisher(redis);
  const displayPairingService = new DisplayPairingService({
    pairingRepo: displayPairingRepository,
    saleRepo,
    tokenIssuer: displayTokenIssuer,
    redis,
    domainEventSink,
  });
  const displayOverlayService = new DisplayOverlayService({
    saleroomDisplaySessionRepo: repos.saleroomDisplaySessionRepository,
    publisher: saleroomRealtimePublisher,
    domainEventSink,
  });
  const displaySnapshotReader = new DisplaySnapshotReader({
    reader: repos.saleroomDisplaySnapshotReader,
    mediaUrlResolver,
  });
  return { displayPairingService, displayOverlayService, displaySnapshotReader };
}

export function createBiddingSaleroom(input: CreateBiddingSaleroomInput): ContainerBiddingSaleroom {
  return {
    ...composeRegistrationAndBidding(input),
    ...composeSaleroomSession(input),
    ...composeSaleroomDisplay(input),
  };
}
