import type { Database } from "@auction/db";
import {
  DrizzleLotTransitionGuardReader,
  createDrizzleLotTransitionRepository,
} from "@auction/persistence";
import type { Env } from "../env.js";
import { LotJobScheduler } from "../jobs/lot-job-scheduler.js";
import {
  type PlatformCatalogLegalEntityIdProvider,
  createPlatformCatalogLegalEntityIdProvider,
} from "../lib/platform-catalog-legal-entity.js";
import { DrizzleConditionReportRequestRepository } from "../repositories/drizzle-condition-report-request.repository.js";
import { DrizzleLotSoftDeleteGuardReader } from "../repositories/drizzle-lot-soft-delete-guard.reader.js";
import { DrizzleLotSoftDeleteSideEffects } from "../repositories/drizzle-lot-soft-delete.side-effects.js";
import { DrizzleSaleSoftDeleteGuardReader } from "../repositories/drizzle-sale-soft-delete-guard.reader.js";
import { DrizzleSaleSoftDeleteSideEffects } from "../repositories/drizzle-sale-soft-delete.side-effects.js";
import { SalePressArchiveRepository } from "../repositories/sale-press-archive.repository.js";
import { ArtistDeleteService } from "../services/artist-delete.service.js";
import { ArtistProfileService } from "../services/artist-profile.service.js";
import { CatalogSoftDeleteOrchestrator } from "../services/catalog/catalog-soft-delete-orchestrator.js";
import { CategoryService } from "../services/category.service.js";
import { ConditionReportService } from "../services/condition-report.service.js";
import type {
  IItemSubmissionAdminApi,
  IItemSubmissionSellerApi,
  IItemSubmissionService,
} from "../services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { ILotSoftDeleteService } from "../services/interfaces/lot-soft-delete.js";
import type { ILotStatusAdminService } from "../services/interfaces/lot-status-admin.js";
import type { ISalePublishService } from "../services/interfaces/sale-publish.js";
import type { ISaleSoftDeleteService } from "../services/interfaces/sale-soft-delete.js";
import { ItemSubmissionService } from "../services/item-submission.service.js";
import { LotNotificationCoordinator } from "../services/lot-notification-coordinator.js";
import { LotSoftDeleteService } from "../services/lot-soft-delete.service.js";
import { LotStatusAdminService } from "../services/lot-status-admin.service.js";
import { LotTransitionOrchestrator } from "../services/lot-transition-orchestrator.js";
import { LotService } from "../services/lot.service.js";
import { PressArchiveReadService } from "../services/press-archive-read.service.js";
import { SaleBiddersService } from "../services/sale-bidders.service.js";
import { SaleFollowService } from "../services/sale-follow.service.js";
import { SaleListReadService } from "../services/sale-list-read.service.js";
import { SaleSoftDeleteService } from "../services/sale-soft-delete.service.js";
import { SaleStatusTransitionService } from "../services/sale-status-transition.service.js";
import { SaleService } from "../services/sale.service.js";
import { SalePublishService } from "../services/sale/sale-publish.service.js";
import { VenueService } from "../services/venue.service.js";
import type { ContainerCatalogAdminReaders } from "./create-catalog-admin-readers.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";
import type { ContainerSaleRegistrationServices } from "./create-sale-registration-services.js";

export type ContainerLotCatalogServices = {
  lotJobScheduler: ILotJobScheduler;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotService: LotService;
  conditionReportService: ConditionReportService;
  saleFollowService: SaleFollowService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  saleService: SaleService;
  saleListReadService: SaleListReadService;
  pressArchiveReadService: PressArchiveReadService;
  saleSoftDeleteService: ISaleSoftDeleteService;
  lotSoftDeleteService: ILotSoftDeleteService;
  saleStatusTransitionService: SaleStatusTransitionService;
  saleBiddersService: SaleBiddersService;
  itemSubmissionService: IItemSubmissionService;
  itemSubmissionSellerApi: IItemSubmissionSellerApi;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  categoryService: CategoryService;
  venueService: VenueService;
  artistProfileService: ArtistProfileService;
  artistDeleteService: ArtistDeleteService;
};

export type CreateLotCatalogServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  lotLifecycle: ContainerLotLifecycle;
  complianceMedia: ContainerComplianceMedia;
  saleRegistration: ContainerSaleRegistrationServices;
  adminReaders: ContainerCatalogAdminReaders;
};

export function createLotCatalogServices(
  input: CreateLotCatalogServicesInput,
): ContainerLotCatalogServices {
  const {
    env,
    db,
    infra,
    repos,
    platform,
    lotLifecycle,
    complianceMedia,
    saleRegistration,
    adminReaders,
  } = input;
  const { bullConnection } = infra;
  const {
    lotRepo,
    saleRepo,
    repoFactory,
    watchlistRepo,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    saleFollowRepo,
    venueRepo,
    saleBiddersReader,
    itemSubmissionRepository,
    userRepo,
    categoryRepo,
    artistProfileRepo,
  } = repos;
  const {
    userNotificationPublisher,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    lotLifecycleRecording,
    stripeConnectService,
    artistRegistryService,
  } = platform;
  const { lotLifecycleService } = lotLifecycle;
  const { mediaUrlResolver, catalogueMediaUrlResolver, mediaAssetEnricher, imageCleanupService } =
    complianceMedia;
  const { qrCodeService } = adminReaders;
  const { telephoneBidBookingService } = saleRegistration;

  const lotJobScheduler: ILotJobScheduler = new LotJobScheduler(
    bullConnection,
    (lotId) => lotLifecycleService.processActivateJob(lotId),
    (lotId) => lotLifecycleService.processEndJob(lotId),
  );

  const lotTransitionGuardReader = new DrizzleLotTransitionGuardReader(db);
  const lotTransitionRepository = createDrizzleLotTransitionRepository(db);
  const lotTransitionOrchestrator = new LotTransitionOrchestrator(
    db,
    lotTransitionRepository,
    lotTransitionGuardReader,
    lotLifecycleRecording,
    lotRepo,
    lotJobScheduler,
  );

  const lotNotificationCoordinator = new LotNotificationCoordinator(
    repos.notificationWriteRepo,
    userNotificationPublisher,
  );

  const lotService = new LotService({
    lotRepo,
    saleRepo,
    bids: repoFactory.root.bid,
    watchlist: watchlistRepo,
    jobScheduler: lotJobScheduler,
    lotNotifications: lotNotificationCoordinator,
    imageCleanup: imageCleanupService,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    enforceIndividualConnectOnPublish: stripeConnectService.isConfigured(),
    db,
    domainEventPublisher,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    lotLifecycleRecording,
    lotTransitionOrchestrator,
    qrCodeService,
    telephoneBidBookingService,
    repoFactory,
  });

  const conditionReportRequestRepo = new DrizzleConditionReportRequestRepository(db);
  const conditionReportService = new ConditionReportService(
    db,
    lotRepo,
    legalEntityRepository,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    conditionReportRequestRepo,
  );

  const saleFollowService = new SaleFollowService(saleFollowRepo, saleRepo);
  const resolvePlatformCatalogLegalEntityId = createPlatformCatalogLegalEntityIdProvider({
    db,
    configuredId: env.PLATFORM_CATALOG_LEGAL_ENTITY_ID,
  });
  const salePublishService: ISalePublishService = new SalePublishService({
    saleRepo,
    lotRepo,
    jobScheduler: lotJobScheduler,
    resolvePlatformCatalogLegalEntityId,
    imageCleanup: imageCleanupService,
    saleFollowReader: saleFollowService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    db,
    domainEventPublisher,
    lotLifecycleRecording,
    legalEntityRepository,
    venueRepository: venueRepo,
    enforceIndividualConnectOnPublish: stripeConnectService.isConfigured(),
    qrCodeService,
    repoFactory,
  });
  const saleService = new SaleService({
    saleRepo,
    lotRepo,
    jobScheduler: lotJobScheduler,
    resolvePlatformCatalogLegalEntityId,
    imageCleanup: imageCleanupService,
    saleFollowReader: saleFollowService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    englishOnlyAuctions: env.ENGLISH_ONLY_AUCTIONS,
    db,
    domainEventPublisher,
    lotLifecycleRecording,
    legalEntityRepository,
    venueRepository: venueRepo,
    enforceIndividualConnectOnPublish: stripeConnectService.isConfigured(),
    qrCodeService,
    repoFactory,
    salePublishService,
  });
  const saleListReadService = new SaleListReadService(
    saleRepo,
    lotRepo,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
  );
  const pressArchiveReadService = new PressArchiveReadService(
    new SalePressArchiveRepository(saleRepo),
  );
  const catalogSoftDeleteOrchestrator = new CatalogSoftDeleteOrchestrator(
    lotJobScheduler,
    db,
    domainEventPublisher,
  );
  const lotSoftDeleteGuardReader = new DrizzleLotSoftDeleteGuardReader(db);
  const saleSoftDeleteGuardReader = new DrizzleSaleSoftDeleteGuardReader(db);
  const saleSoftDeleteSideEffects = new DrizzleSaleSoftDeleteSideEffects(db, lotLifecycleRecording);
  const saleSoftDeleteService = new SaleSoftDeleteService(
    saleRepo,
    lotRepo,
    saleSoftDeleteGuardReader,
    saleSoftDeleteSideEffects,
    catalogSoftDeleteOrchestrator,
  );
  const lotSoftDeleteSideEffects = new DrizzleLotSoftDeleteSideEffects(db, lotLifecycleRecording);
  const lotSoftDeleteService = new LotSoftDeleteService(
    lotRepo,
    saleRepo,
    lotSoftDeleteGuardReader,
    lotSoftDeleteSideEffects,
    catalogSoftDeleteOrchestrator,
  );
  const lotStatusAdminService: ILotStatusAdminService = new LotStatusAdminService(
    saleRepo,
    lotRepo,
    lotJobScheduler,
    db,
    lotLifecycleRecording,
    legalEntityRepository,
    stripeConnectService.isConfigured(),
    repoFactory,
  );
  const saleStatusTransitionService = new SaleStatusTransitionService(
    saleRepo,
    lotRepo,
    lotJobScheduler,
    db,
    domainEventPublisher,
    lotLifecycleRecording,
    legalEntityRepository,
    stripeConnectService.isConfigured(),
    repoFactory,
    lotStatusAdminService,
  );

  const saleBiddersService = new SaleBiddersService(saleBiddersReader, saleRepo);
  const itemSubmissionService = new ItemSubmissionService(
    db,
    itemSubmissionRepository,
    userRepo,
    notificationDispatcher,
    imageCleanupService,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    domainEventPublisher,
    mediaUrlResolver,
    mediaAssetEnricher,
    lotLifecycleRecording,
    repoFactory,
  );

  const categoryService = new CategoryService(categoryRepo, db, domainEventPublisher);
  const venueService = new VenueService(venueRepo, db, domainEventPublisher);
  const artistProfileService = new ArtistProfileService(artistProfileRepo, artistRegistryService);
  const artistDeleteService = new ArtistDeleteService(
    artistProfileRepo,
    artistProfileRepo,
    db,
    domainEventPublisher,
  );

  return {
    lotJobScheduler,
    lotTransitionOrchestrator,
    lotService,
    conditionReportService,
    saleFollowService,
    resolvePlatformCatalogLegalEntityId,
    saleService,
    saleListReadService,
    pressArchiveReadService,
    saleSoftDeleteService,
    lotSoftDeleteService,
    saleStatusTransitionService,
    saleBiddersService,
    itemSubmissionService,
    itemSubmissionSellerApi: itemSubmissionService,
    itemSubmissionAdminApi: itemSubmissionService,
    categoryService,
    venueService,
    artistProfileService,
    artistDeleteService,
  };
}
