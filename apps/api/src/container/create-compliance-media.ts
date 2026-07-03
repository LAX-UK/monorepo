import type { Database } from "@auction/db";
import {
  CompositeMarketingEventPublisher,
  type IClickIdStore,
  type IMarketingEventPublisher,
  InMemoryCircuitBreaker,
  MetaCapiMarketingEventPublisher,
  SgtmMarketingEventPublisher,
} from "@auction/marketing-events";
import type { Env } from "../env.js";
import { createExportProviderDeps } from "../exports/deps.js";
import { createExportProviders } from "../exports/registry.js";
import { BullmqMarketingEventQueue } from "../infrastructure/bullmq-marketing-event.queue.js";
import { CachedClickIdStore } from "../infrastructure/cached-click-id.store.js";
import { DrizzleMarketingEventOutboxRepository } from "../infrastructure/drizzle-marketing-event-outbox.repository.js";
import { EventMarketingConsentGate } from "../infrastructure/header-marketing-consent.gate.js";
import { NoopMarketingEventOutboxRepository } from "../infrastructure/noop-marketing-event-outbox.repository.js";
import { NoopMarketingEventPublisher } from "../infrastructure/noop-marketing-event.publisher.js";
import { NoopMarketingEventQueue } from "../infrastructure/noop-marketing-event.queue.js";
import { PostgresClickIdStore } from "../infrastructure/postgres-click-id.store.js";
import { RedisClickIdStore } from "../infrastructure/redis-click-id.store.js";
import { getMarketingEventsConfig } from "../lib/marketing-events-enabled.js";
import { VeriffScreeningProvider } from "../lib/veriff/veriff-screening-provider.js";
import { VeriffWatchlistFetcher } from "../lib/veriff/veriff-watchlist-fetcher.js";
import { VeriffWebhookVerifier } from "../lib/veriff/veriff-webhook-verifier.js";
import { DrizzleExportJobRepository } from "../repositories/drizzle-export-job.repository.js";
import { AdminSourceOfFundsQueryService } from "../services/admin/admin-source-of-funds-query.service.js";
import { LegalEntityDocumentAdminService } from "../services/admin/legal-entity-document-admin.service.js";
import { DefaultAmlDecisionPolicy } from "../services/aml/aml-decision.policy.js";
import { AmlService } from "../services/aml/aml.service.js";
import { EntityDocumentService } from "../services/entity-document.service.js";
import { ExportFileStorage } from "../services/export/export-file-storage.js";
import { RedisExportProgressStore } from "../services/export/export-progress.store.js";
import { ExportService } from "../services/export/export.service.js";
import { ImageCleanupService } from "../services/image-cleanup.service.js";
import type { IKycService } from "../services/interfaces/kyc-service.js";
import type { IMarketingEventService } from "../services/interfaces/marketing-event-service.js";
import type { IUploadService } from "../services/interfaces/upload-service.js";
import { KycResubmissionNotifier } from "../services/kyc/kyc-resubmission-notifier.js";
import { VeriffKycService } from "../services/kyc/veriff-kyc.service.js";
import { MarketingEventService } from "../services/marketing-event.service.js";
import { MediaAssetEnricher } from "../services/media-asset-enricher.js";
import { MediaUrlResolver } from "../services/media-url-resolver.js";
import { PerRequestSigningPolicy, StableSigningPolicy } from "../services/signed-url-policy.js";
import { SourceOfFundsDocumentCollectionService } from "../services/source-of-funds/source-of-funds-document-collection.service.js";
import { SourceOfFundsDocumentReviewService } from "../services/source-of-funds/source-of-funds-document-review.service.js";
import { SourceOfFundsSettlementReadService } from "../services/source-of-funds/source-of-funds-settlement-read.service.js";
import { SourceOfFundsService } from "../services/source-of-funds/source-of-funds.service.js";
import { UploadService } from "../services/upload.service.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerComplianceMedia = {
  marketingEventService: IMarketingEventService;
  marketingEventPublisher: IMarketingEventPublisher;
  clickIdStore: IClickIdStore;
  kycService: IKycService;
  kycResubmissionNotifier: KycResubmissionNotifier;
  amlService: AmlService;
  sourceOfFundsService: SourceOfFundsService;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  exportService: ExportService;
  mediaUrlResolver: MediaUrlResolver;
  catalogueMediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  imageCleanupService: ImageCleanupService;
  uploadService: IUploadService;
  lotDocumentService: EntityDocumentService<string>;
  saleDocumentService: EntityDocumentService<string>;
  submissionDocumentService: EntityDocumentService<string>;
};

export type CreateComplianceMediaInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
};

export function createComplianceMedia(input: CreateComplianceMediaInput): ContainerComplianceMedia {
  const { env, db, infra, repos, platform } = input;
  const {
    redis,
    objectStorage,
    dataExportQueue,
    marketingEventsBullQueue,
    imageCleanupQueue,
    uploadValidationQueue,
    emailService,
  } = infra;
  const {
    kycRepository,
    userRepo,
    notificationWriteRepo,
    amlScreeningRepository,
    amlHoldStore,
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    sourceOfFundsSettlementReader,
    adminUserReader,
    lotDocumentRepo,
    saleDocumentRepo,
    submissionDocumentRepo,
  } = repos;
  const { domainEventPublisher } = platform;

  const marketingConfig = getMarketingEventsConfig(env);
  const marketingEnabled = marketingConfig !== undefined;
  const clickIdStore: IClickIdStore = marketingEnabled
    ? new CachedClickIdStore(new PostgresClickIdStore(db), new RedisClickIdStore(redis))
    : new RedisClickIdStore(redis);
  const marketingOutbox = marketingEnabled
    ? new DrizzleMarketingEventOutboxRepository(db)
    : new NoopMarketingEventOutboxRepository();
  const marketingConsentGate = new EventMarketingConsentGate();
  const marketingEventQueue = marketingEnabled
    ? new BullmqMarketingEventQueue(marketingEventsBullQueue)
    : new NoopMarketingEventQueue();
  const marketingEventPublisher: IMarketingEventPublisher = marketingConfig
    ? new CompositeMarketingEventPublisher(
        new SgtmMarketingEventPublisher(
          marketingConfig.sgtmEndpointUrl,
          marketingConfig.ga4MeasurementId,
        ),
        new MetaCapiMarketingEventPublisher(
          marketingConfig.metaPixelId,
          marketingConfig.metaCapiAccessToken,
          marketingConfig.metaCapiTestEventCode,
          marketingConfig.metaGraphApiVersion,
        ),
        new InMemoryCircuitBreaker(),
      )
    : new NoopMarketingEventPublisher();
  const marketingEventService = new MarketingEventService(
    marketingOutbox,
    marketingEventQueue,
    marketingConsentGate,
  );
  const kycService: IKycService = new VeriffKycService(
    env,
    kycRepository,
    db,
    marketingEventService,
  );
  const kycResubmissionNotifier = new KycResubmissionNotifier(
    userRepo,
    emailService,
    notificationWriteRepo,
    env.WEB_ORIGIN,
  );
  const amlService = new AmlService(
    db,
    new VeriffWebhookVerifier(env.VERIFF_API_KEY, env.VERIFF_SHARED_SECRET),
    new DefaultAmlDecisionPolicy(),
    amlScreeningRepository,
    amlScreeningRepository,
    amlHoldStore,
    domainEventPublisher,
    VeriffScreeningProvider.fromEnv(env),
    VeriffWatchlistFetcher.fromEnv(env),
  );
  const sourceOfFundsService = new SourceOfFundsService(
    sourceOfFundsRepository,
    {
      thresholdAmount: env.SOF_THRESHOLD_AMOUNT,
      currency: env.SOF_THRESHOLD_CURRENCY,
      approvalValidityDays: env.SOF_APPROVAL_VALIDITY_DAYS,
    },
    db,
    domainEventPublisher,
  );
  const exportProviderDeps = createExportProviderDeps(db);
  const exportProviders = createExportProviders(exportProviderDeps);
  const exportJobRepo = new DrizzleExportJobRepository(db);
  const exportService = new ExportService(
    db,
    exportJobRepo,
    new RedisExportProgressStore(redis),
    new ExportFileStorage(objectStorage),
    dataExportQueue,
    exportProviders,
    {
      syncMaxRows: env.EXPORT_SYNC_MAX_ROWS,
      staleProcessingMs: env.EXPORT_STALE_PROCESSING_MS,
    },
    domainEventPublisher,
  );
  const mediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new PerRequestSigningPolicy(env.SIGNED_GET_TTL_SEC),
  );
  const sourceOfFundsSettlementReadService = new SourceOfFundsSettlementReadService(
    sourceOfFundsSettlementReader,
  );
  const adminSourceOfFundsQueryService = new AdminSourceOfFundsQueryService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    adminUserReader,
    sourceOfFundsSettlementReadService,
    mediaUrlResolver,
  );
  const sourceOfFundsDocumentCollectionService = new SourceOfFundsDocumentCollectionService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    db,
    domainEventPublisher,
    objectStorage,
    new PerRequestSigningPolicy(env.SOF_DOWNLOAD_TTL_SEC),
    sourceOfFundsSettlementReadService,
  );
  const sourceOfFundsDocumentReviewService = new SourceOfFundsDocumentReviewService(
    sourceOfFundsRepository,
    sourceOfFundsDocumentRepository,
    sourceOfFundsDocumentReviewRepository,
    db,
    domainEventPublisher,
  );
  const catalogueMediaUrlResolver = new MediaUrlResolver(
    objectStorage,
    env.STORAGE_READ_MODE,
    new StableSigningPolicy(Math.max(env.SIGNED_GET_TTL_SEC, 86_400)),
  );
  const mediaAssetEnricher = new MediaAssetEnricher(db, objectStorage);
  const legalEntityDocumentAdminService = new LegalEntityDocumentAdminService(
    repos.legalEntityDocumentAdminRepository,
    objectStorage,
    mediaUrlResolver,
  );
  const imageCleanupService = new ImageCleanupService(objectStorage, imageCleanupQueue);
  const uploadService = new UploadService(
    objectStorage,
    redis,
    uploadValidationQueue,
    mediaUrlResolver,
    { repo: repos.uploadPersistenceRepository },
  );
  const lotDocumentService = new EntityDocumentService(
    "lot",
    lotDocumentRepo,
    repos.uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );
  const saleDocumentService = new EntityDocumentService(
    "sale",
    saleDocumentRepo,
    repos.uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );
  const submissionDocumentService = new EntityDocumentService(
    "submission",
    submissionDocumentRepo,
    repos.uploadObjectReader,
    objectStorage,
    mediaUrlResolver,
  );

  return {
    marketingEventService,
    marketingEventPublisher,
    clickIdStore,
    kycService,
    kycResubmissionNotifier,
    amlService,
    sourceOfFundsService,
    adminSourceOfFundsQueryService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
    exportService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    legalEntityDocumentAdminService,
    imageCleanupService,
    uploadService,
    lotDocumentService,
    saleDocumentService,
    submissionDocumentService,
  };
}
