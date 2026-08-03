import type { Database } from "@auction/db";
import {
  DrizzleAdminSubmissionsSummaryReader,
  DrizzleExportJobRepository,
} from "@auction/persistence/repositories";
import type { Env } from "../env.js";
import { AdminLotAttentionService } from "../services/admin/admin-lot-attention.service.js";
import { AdminLotDetailMetricsService } from "../services/admin/admin-lot-detail-metrics.service.js";
import { AdminLotOverviewKpiTrendService } from "../services/admin/admin-lot-overview-kpi-trend.service.js";
import { AdminLotsEndedKpiTrendService } from "../services/admin/admin-lots-ended-kpi-trend.service.js";
import { AdminLotsHammerKpiTrendService } from "../services/admin/admin-lots-hammer-kpi-trend.service.js";
import { AdminLotsKpiTrendService } from "../services/admin/admin-lots-kpi-trend.service.js";
import { AdminLotsListSummaryService } from "../services/admin/admin-lots-list-summary.service.js";
import {
  createAdminNavCountsAuthorityPorts,
  createAdminNavCountsDeps,
} from "../services/admin/admin-nav-counts.deps.js";
import { AdminNavCountsService } from "../services/admin/admin-nav-counts.service.js";
import { AdminPaymentsKpiTrendService } from "../services/admin/admin-payments-kpi-trend.service.js";
import { AdminPayoutsKpiTrendService } from "../services/admin/admin-payouts-kpi-trend.service.js";
import { AdminSaleAttentionService } from "../services/admin/admin-sale-attention.service.js";
import { AdminSaleDetailMetricsService } from "../services/admin/admin-sale-detail-metrics.service.js";
import { AdminSaleOverviewKpiTrendService } from "../services/admin/admin-sale-overview-kpi-trend.service.js";
import { AdminSalesKpiTrendService } from "../services/admin/admin-sales-kpi-trend.service.js";
import { AdminSalesListSummaryService } from "../services/admin/admin-sales-list-summary.service.js";
import { AdminSubmissionsKpiTrendService } from "../services/admin/admin-submissions-kpi-trend.service.js";
import { AdminSubmissionsListSummaryService } from "../services/admin/admin-submissions-list-summary.service.js";
import {
  attachAdminDashboardMetrics,
  attachAdminDetailBoardServices,
  createAdminRouteServices,
} from "../services/admin/create-admin-route-services.js";
import { attachAdminSatelliteServices } from "../services/admin/create-admin-satellite-services.js";
import type { AdminRouteServices } from "../services/interfaces/admin-routes.js";
import type { IPayoutStatementApplicationService } from "../services/interfaces/finance-routes/finance-payout-statement.js";
import type { ContainerBiddingSaleroom } from "./create-bidding-saleroom.js";
import type { ContainerCatalogServices } from "./create-catalog-services.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";
import type { ContainerUserMiscServices } from "./create-user-misc-services.js";

export type ContainerAdminServices = {
  admin: AdminRouteServices;
};

export type CreateAdminServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
  catalog: ContainerCatalogServices;
  payments: ContainerPaymentsServices;
  bidding: ContainerBiddingSaleroom;
  userMisc: ContainerUserMiscServices;
  payoutStatementApplication: IPayoutStatementApplicationService;
};

export function createAdminServices(input: CreateAdminServicesInput): ContainerAdminServices {
  const { env, db, infra, repos, platform, complianceMedia, catalog, payments, bidding, userMisc } =
    input;
  const { redis, cache } = infra;
  const {
    lotRepo,
    paymentRepo,
    saleRepo,
    payoutRepository,
    itemSubmissionRepository,
    saleOverviewKpiTrendReader,
    saleRevenueSnapshotReader,
    repoFactory,
    emailObservabilityRepository,
    attentionFeedReader,
    xeroConnRepo,
    xeroWebhookEventRepository,
    paymentExtRepo,
    userRepo,
    legalEntityRepository,
    adminDomainEventReader,
    adminFinanceIssueSnapshotReader,
    adminManualReviewPaymentReader,
    adminManualReviewPaymentEnrichmentReader,
    adminOnboardingIssuesReader,
    adminReviewTaskReader,
    adminReviewTaskRepository,
    adminWorkItemsReader,
    adminSaleReadinessReader,
    adminLegalEntityBrowseReader,
    adminDisputeCaseEnrichmentReader,
    impersonationSessionRepository,
    impersonationDomainEventReader,
  } = repos;
  const {
    domainEventSink,
    impersonationAuditService,
    cachedUserSuspensionChecker,
    legalEntityLifecycleAdminService,
    artistRegistryService,
    stripeConnectService,
  } = platform;
  const {
    legalEntityDocumentAdminService,
    amlService,
    amlScreeningReader,
    adminSourceOfFundsQueryService,
    sourceOfFundsService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
    mediaUrlResolver,
    mediaAssetEnricher,
  } = complianceMedia;
  const {
    categoryService,
    artistProfileService,
    itemSubmissionAdminApi,
    lotService,
    adminLotBrowseService,
    lotTransitionOrchestrator,
    lotLifecycleQueryService,
    resolvePlatformCatalogLegalEntityId,
    qrCodeService,
    qrCodeAnalytics,
    conditionReportService,
    saleroomCheckInService,
    telephoneBidBookingService,
    saleService,
  } = catalog;
  const {
    paymentAdminService,
    xeroOAuthService,
    lotFulfilmentService,
    lotFulfilmentRepository,
    adminMetricsService,
  } = payments;
  const {
    saleRegistrationService,
    saleroomService,
    adminSaleOperationsSnapshotService,
    bidService,
    saleroomOnBlockPolicy,
    displayPairingService,
    displayOverlayService,
  } = bidding;
  const {
    adminUserService,
    profileService,
    invitationService,
    invitationRepository,
    adminPaymentListQueryService,
  } = userMisc;
  const { adminUserReader } = repos;

  const adminBase = createAdminRouteServices({
    transactionRunner: platform.transactionRunner,
    domainEventSink,
    impersonationSessionRepository,
    impersonationDomainEventReader,
    impersonationAuditService,
    userSuspensionChecker: cachedUserSuspensionChecker,
    legalEntityRepository,
    legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService,
    categoryService,
    artistProfileService,
    emailObservabilityRepository,
    adminUserService,
    adminUserReader,
    profileService,
    adminMetricsService,
    attentionFeedReader,
    itemSubmissionAdminApi,
    paymentService: paymentAdminService,
    adminPaymentListQueryService,
    lotService,
    adminLotBrowseService,
    lotTransitionOrchestrator,
    lotLifecycleQueryService,
    saleRegistrationService,
    artistRegistryService,
    resolvePlatformCatalogLegalEntityId,
    invitationService,
    invitationRepository,
    xeroOAuthService,
    xeroConnectionRepository: xeroConnRepo,
    xeroWebhookEventRepository,
    paymentExternalRefRepository: paymentExtRepo,
    userRepository: userRepo,
    displayPairingService,
    displayOverlayService,
    qrCodeService,
    qrCodeAnalytics,
    conditionReportService,
    conditionReportRequestRepository: repos.conditionReportRequestRepository,
    mediaUrlResolver,
    mediaAssetEnricher,
    amlService,
    amlScreeningReader,
    adminSourceOfFundsQueryService,
    sourceOfFundsService,
    sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService,
    stripeConnectService,
    saleroomService,
    adminSaleOperationsSnapshotService,
    saleroomCheckInService,
    saleExpectedGuestsService: catalog.saleExpectedGuestsService,
    lotFulfilmentService,
    lotFulfilmentRepository,
    bidService,
    saleroomOnBlockPolicy,
    paddleService: catalog.paddleService,
    telephoneBidBookingService,
    redis,
    findLotById: async (lotId) => {
      const lot = await repoFactory.root.lot.findById(lotId);
      if (!lot?.saleId) return null;
      return { id: lot.id, saleId: lot.saleId };
    },
    adminDomainEventReader,
    adminFinanceIssueSnapshotReader,
    adminManualReviewPaymentReader,
    adminManualReviewPaymentEnrichmentReader,
    adminOnboardingIssuesReader,
    adminReviewTaskReader,
    adminWorkItemsReader,
    adminSaleReadinessReader,
    adminLegalEntityBrowseReader,
    adminDisputeCaseEnrichmentReader,
    bidRepo: repoFactory.root.bid,
    payoutService: platform.payoutService,
    payoutSettlementService: platform.payoutSettlementService,
    payoutStatementApplication: input.payoutStatementApplication,
    env,
  });

  const adminLotsKpiTrendService = new AdminLotsKpiTrendService(lotRepo);
  const adminLotsEndedKpiTrendService = new AdminLotsEndedKpiTrendService(lotRepo);
  const adminLotsHammerKpiTrendService = new AdminLotsHammerKpiTrendService(lotRepo);
  const adminPaymentsKpiTrendService = new AdminPaymentsKpiTrendService(paymentRepo);
  const adminSalesKpiTrendService = new AdminSalesKpiTrendService(saleRepo);
  const adminPayoutsKpiTrendService = new AdminPayoutsKpiTrendService(payoutRepository);
  const adminSubmissionsKpiTrendService = new AdminSubmissionsKpiTrendService(
    itemSubmissionRepository,
  );
  const adminSalesListSummaryService = new AdminSalesListSummaryService(saleRepo, lotRepo);
  const adminLotsListSummaryService = new AdminLotsListSummaryService(
    lotRepo,
    adminReviewTaskReader,
  );
  const adminSubmissionsListSummaryService = new AdminSubmissionsListSummaryService(
    new DrizzleAdminSubmissionsSummaryReader(db),
  );
  const adminSaleDetailMetricsService = new AdminSaleDetailMetricsService(
    lotRepo,
    saleRevenueSnapshotReader,
    adminDomainEventReader,
    new DrizzleExportJobRepository(db),
  );
  const adminSaleOverviewKpiTrendService = new AdminSaleOverviewKpiTrendService(
    saleRepo,
    saleOverviewKpiTrendReader,
  );
  const adminSaleAttentionService = new AdminSaleAttentionService(
    repos.saleAttentionSignalsReader,
    legalEntityRepository,
    stripeConnectService,
  );
  const adminLotDetailMetricsService = new AdminLotDetailMetricsService(
    lotRepo,
    repoFactory.root.bid,
  );
  const adminLotOverviewKpiTrendService = new AdminLotOverviewKpiTrendService(
    lotRepo,
    repoFactory.root.bid,
  );
  const adminLotAttentionService = new AdminLotAttentionService(
    lotRepo,
    adminReviewTaskRepository,
    legalEntityRepository,
    stripeConnectService,
  );

  const adminNavCountsService = new AdminNavCountsService(
    createAdminNavCountsDeps({
      saleroomLiveSessionCounter: repos.saleroomLiveSessionCounter,
      authority: createAdminNavCountsAuthorityPorts(adminBase),
      repoFactory,
      conditionReportService,
      lotFulfilmentService,
      lotFulfilmentRepository,
      saleService,
      amlService,
      sourceOfFundsService,
      telephoneBidBookingService,
    }),
    cache,
    30,
  );

  const admin = attachAdminSatelliteServices(
    attachAdminDetailBoardServices(
      attachAdminDashboardMetrics(adminBase, {
        navCounts: adminNavCountsService,
        lotsKpiTrend: adminLotsKpiTrendService,
        lotsEndedKpiTrend: adminLotsEndedKpiTrendService,
        lotsHammerKpiTrend: adminLotsHammerKpiTrendService,
        paymentsKpiTrend: adminPaymentsKpiTrendService,
        salesKpiTrend: adminSalesKpiTrendService,
        payoutsKpiTrend: adminPayoutsKpiTrendService,
        submissionsKpiTrend: adminSubmissionsKpiTrendService,
        salesListSummary: adminSalesListSummaryService,
        lotsListSummary: adminLotsListSummaryService,
        submissionsListSummary: adminSubmissionsListSummaryService,
      }),
      {
        saleDetailMetrics: adminSaleDetailMetricsService,
        saleOverviewKpiTrend: adminSaleOverviewKpiTrendService,
        saleAttention: adminSaleAttentionService,
        lotDetailMetrics: adminLotDetailMetricsService,
        lotOverviewKpiTrend: adminLotOverviewKpiTrendService,
        lotAttention: adminLotAttentionService,
      },
    ),
    {
      db,
      queueInspector: userMisc.queueAdmin.inspector,
      queueMutator: userMisc.queueAdmin.mutator,
      adminMarketingEventsService: userMisc.adminMarketingEventsService,
      onsiteEventAdminService: catalog.onsiteEventAdminService,
      onsiteEventStaffCheckInService: catalog.onsiteEventStaffCheckInService,
    },
  );

  return { admin };
}
