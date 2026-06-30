import type { Database } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { Env } from "../env.js";
import { LotJobScheduler } from "../jobs/lot-job-scheduler.js";
import { createBaseLogger } from "../lib/logger.js";
import {
  type PlatformCatalogLegalEntityIdProvider,
  createPlatformCatalogLegalEntityIdProvider,
} from "../lib/platform-catalog-legal-entity.js";
import { DrizzleLotSoftDeleteSideEffects } from "../repositories/drizzle-lot-soft-delete.side-effects.js";
import { DrizzleSaleSoftDeleteSideEffects } from "../repositories/drizzle-sale-soft-delete.side-effects.js";
import { SalePressArchiveRepository } from "../repositories/sale-press-archive.repository.js";
import { AdminLotBrowseService } from "../services/admin/admin-lot-browse.service.js";
import { ArtistDeleteService } from "../services/artist-delete.service.js";
import { ArtistProfileService } from "../services/artist-profile.service.js";
import { CategoryService } from "../services/category.service.js";
import { ConditionReportService } from "../services/condition-report.service.js";
import { DashboardQueryService } from "../services/dashboard-query.service.js";
import type { IItemSubmissionService } from "../services/interfaces/item-submission-service.js";
import type { ILotJobScheduler } from "../services/interfaces/job-scheduler.js";
import type { IOnsiteEventCheckInService } from "../services/interfaces/onsite-event-check-in-service.js";
import type { IOnsiteEventRsvpService } from "../services/interfaces/onsite-event-rsvp-service.js";
import { ItemSubmissionService } from "../services/item-submission.service.js";
import { LotLifecycleQueryService } from "../services/lot-lifecycle-query.service.js";
import { LotNotificationCoordinator } from "../services/lot-notification-coordinator.js";
import { LotSoftDeleteService } from "../services/lot-soft-delete.service.js";
import { LotTransitionOrchestrator } from "../services/lot-transition-orchestrator.js";
import { LotService } from "../services/lot.service.js";
import { NotificationQueryService } from "../services/notification-query.service.js";
import { OnsiteEventCheckInService } from "../services/onsite-event-check-in.service.js";
import { OnsiteEventNotifier } from "../services/onsite-event-notifier.js";
import { OnsiteEventRsvpService } from "../services/onsite-event-rsvp.service.js";
import { PaddleService } from "../services/paddle.service.js";
import { PassQrRenderService } from "../services/pass-qr-render.service.js";
import { PressArchiveReadService } from "../services/press-archive-read.service.js";
import { QrCodeAnalyticsService } from "../services/qr-code-analytics.service.js";
import { QrCodeService } from "../services/qr-code.service.js";
import { SaleBiddersService } from "../services/sale-bidders.service.js";
import { SaleFollowService } from "../services/sale-follow.service.js";
import { SaleListReadService } from "../services/sale-list-read.service.js";
import { SaleSoftDeleteService } from "../services/sale-soft-delete.service.js";
import { SaleStatusTransitionService } from "../services/sale-status-transition.service.js";
import { SaleService } from "../services/sale.service.js";
import { SaleroomCheckInService } from "../services/saleroom-check-in.service.js";
import { TelephoneBidBookingService } from "../services/telephone-bid-booking.service.js";
import { TelephoneBookingNotifier } from "../services/telephone-booking-notifier.js";
import { VenueService } from "../services/venue.service.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerLotLifecycle } from "./create-lot-lifecycle.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerCatalogServices = {
  lotJobScheduler: ILotJobScheduler;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotLifecycleQueryService: LotLifecycleQueryService;
  adminLotBrowseService: AdminLotBrowseService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  telephoneBidBookingService: TelephoneBidBookingService;
  paddleService: PaddleService;
  saleroomCheckInService: SaleroomCheckInService;
  onsiteEventRsvpService: IOnsiteEventRsvpService;
  onsiteEventCheckInService: IOnsiteEventCheckInService;
  lotService: LotService;
  conditionReportService: ConditionReportService;
  saleFollowService: SaleFollowService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  saleService: SaleService;
  saleListReadService: SaleListReadService;
  pressArchiveReadService: PressArchiveReadService;
  saleSoftDeleteService: SaleSoftDeleteService;
  lotSoftDeleteService: LotSoftDeleteService;
  saleStatusTransitionService: SaleStatusTransitionService;
  saleBiddersService: SaleBiddersService;
  itemSubmissionService: IItemSubmissionService;
  categoryService: CategoryService;
  venueService: VenueService;
  artistProfileService: ArtistProfileService;
  artistDeleteService: ArtistDeleteService;
  dashboardQueryService: DashboardQueryService;
  notificationQueryService: NotificationQueryService;
};

export type CreateCatalogServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  lotLifecycle: ContainerLotLifecycle;
  complianceMedia: ContainerComplianceMedia;
};

export function createCatalogServices(input: CreateCatalogServicesInput): ContainerCatalogServices {
  const { env, db, infra, repos, platform, lotLifecycle, complianceMedia } = input;
  const { redis, bullConnection, cache, qrCodeScanQueue } = infra;
  const {
    lotRepo,
    saleRepo,
    repoFactory,
    watchlistRepo,
    legalEntityNotificationRecipients,
    legalEntityRepository,
    telephoneBidBookingRepo,
    paddleRepo,
    saleroomCheckInRepo,
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventClientReader,
    onsiteEventCheckInLogRepo,
    saleFollowRepo,
    venueRepo,
    saleBiddersReader,
    itemSubmissionRepository,
    userRepo,
    categoryRepo,
    artistProfileRepo,
    notificationReadRepo,
    notificationWriteRepo,
    amlHoldStore,
  } = repos;
  const {
    lotLifecycleEventRecorder,
    userNotificationPublisher,
    transactionalMailer,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
    lotLifecycleRecording,
    stripeConnectService,
    artistRegistryService,
  } = platform;
  const { lotLifecycleService } = lotLifecycle;
  const {
    kycService,
    mediaUrlResolver,
    catalogueMediaUrlResolver,
    mediaAssetEnricher,
    imageCleanupService,
  } = complianceMedia;

  const lotJobScheduler: ILotJobScheduler = new LotJobScheduler(
    bullConnection,
    (lotId) => lotLifecycleService.processActivateJob(lotId),
    (lotId) => lotLifecycleService.processEndJob(lotId),
  );

  const lotTransitionOrchestrator = new LotTransitionOrchestrator(
    db,
    lotLifecycleEventRecorder,
    lotRepo,
    lotJobScheduler,
  );
  const lotLifecycleQueryService = new LotLifecycleQueryService(db);
  const adminLotBrowseService = new AdminLotBrowseService(db);
  const qrCodeService = new QrCodeService(
    db,
    redis,
    env.WEB_ORIGIN,
    createBaseLogger(env).child({ component: "qr_code" }),
    qrCodeScanQueue,
  );
  const qrCodeAnalytics = new QrCodeAnalyticsService(db);

  const lotNotificationCoordinator = new LotNotificationCoordinator(
    notificationWriteRepo,
    userNotificationPublisher,
  );

  const telephoneBookingNotifier = new TelephoneBookingNotifier(
    db,
    transactionalMailer,
    notificationWriteRepo,
    env.WEB_ORIGIN,
    env.OPS_SUPPORT_EMAIL,
  );
  const telephoneBidBookingService = new TelephoneBidBookingService(
    db,
    telephoneBidBookingRepo,
    legalEntityRepository,
    kycService,
    amlHoldStore,
    domainEventPublisher,
    telephoneBookingNotifier,
  );

  const SELF_SERVICE_BID_WINDOW_MS = 30 * 60_000;
  const paddleService = new PaddleService(paddleRepo, db, cache, async (saleId, userId) => {
    const cutoff = new Date(Date.now() - SELF_SERVICE_BID_WINDOW_MS);
    const rows = await db
      .select({ id: bid.id })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(lot.saleId, saleId),
          eq(bid.bidderId, userId),
          or(eq(bid.placedVia, "web"), isNull(bid.placedVia)),
          gt(bid.createdAt, cutoff),
        ),
      )
      .limit(1);
    return rows.length > 0;
  });

  const saleroomCheckInService = new SaleroomCheckInService(
    db,
    saleroomCheckInRepo,
    legalEntityRepository,
    paddleService,
  );

  const passQrRenderService = new PassQrRenderService();
  const onsiteEventLog = createBaseLogger(env).child({ component: "onsite_event" });
  const onsiteEventNotifier = new OnsiteEventNotifier(
    transactionalMailer,
    passQrRenderService,
    env.OPS_SUPPORT_EMAIL ?? "events@lax.bid",
    onsiteEventLog.child({ module: "notifier" }),
  );
  const onsiteEventRsvpService = new OnsiteEventRsvpService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventClientReader,
    onsiteEventNotifier,
    env.CHECK_IN_TOKEN_SECRET ?? env.BETTER_AUTH_SECRET,
    onsiteEventLog.child({ module: "rsvp" }),
  );
  const onsiteEventCheckInService = new OnsiteEventCheckInService(
    onsiteEventRepo,
    onsiteEventRsvpRepo,
    onsiteEventCheckInLogRepo,
    passQrRenderService,
    onsiteEventLog.child({ module: "check_in" }),
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

  const conditionReportService = new ConditionReportService(
    db,
    lotRepo,
    legalEntityRepository,
    domainEventPublisher,
    notificationDispatcher,
    notificationFactory,
  );

  const saleFollowService = new SaleFollowService(saleFollowRepo, saleRepo);
  const resolvePlatformCatalogLegalEntityId = createPlatformCatalogLegalEntityIdProvider({
    db,
    configuredId: env.PLATFORM_CATALOG_LEGAL_ENTITY_ID,
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
  const saleSoftDeleteSideEffects = new DrizzleSaleSoftDeleteSideEffects(db, lotLifecycleRecording);
  const saleSoftDeleteService = new SaleSoftDeleteService(
    saleRepo,
    lotRepo,
    saleSoftDeleteSideEffects,
    lotJobScheduler,
    db,
    domainEventPublisher,
  );
  const lotSoftDeleteSideEffects = new DrizzleLotSoftDeleteSideEffects(db, lotLifecycleRecording);
  const lotSoftDeleteService = new LotSoftDeleteService(
    lotRepo,
    saleRepo,
    lotSoftDeleteSideEffects,
    lotJobScheduler,
    db,
    domainEventPublisher,
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
  const dashboardQueryService = new DashboardQueryService(repoFactory);
  const notificationQueryService = new NotificationQueryService(notificationReadRepo);

  return {
    lotJobScheduler,
    lotTransitionOrchestrator,
    lotLifecycleQueryService,
    adminLotBrowseService,
    qrCodeService,
    qrCodeAnalytics,
    telephoneBidBookingService,
    paddleService,
    saleroomCheckInService,
    onsiteEventRsvpService,
    onsiteEventCheckInService,
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
    categoryService,
    venueService,
    artistProfileService,
    artistDeleteService,
    dashboardQueryService,
    notificationQueryService,
  };
}
