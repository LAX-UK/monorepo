import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { AdminLotsKpiTrendService } from "../services/admin/admin-lots-kpi-trend.service.js";
import { createAdminNavCountsDeps } from "../services/admin/admin-nav-counts.deps.js";
import { AdminNavCountsService } from "../services/admin/admin-nav-counts.service.js";
import { AdminPaymentsKpiTrendService } from "../services/admin/admin-payments-kpi-trend.service.js";
import { AdminPayoutsKpiTrendService } from "../services/admin/admin-payouts-kpi-trend.service.js";
import { AdminSalesKpiTrendService } from "../services/admin/admin-sales-kpi-trend.service.js";
import {
  attachAdminDashboardMetrics,
  createAdminRouteServices,
} from "../services/admin/create-admin-route-services.js";
import type { AdminRouteServices } from "../services/interfaces/admin-routes.js";
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
  adminNavCountsService: AdminNavCountsService;
  adminLotsKpiTrendService: AdminLotsKpiTrendService;
  adminPaymentsKpiTrendService: AdminPaymentsKpiTrendService;
  adminSalesKpiTrendService: AdminSalesKpiTrendService;
  adminPayoutsKpiTrendService: AdminPayoutsKpiTrendService;
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
};

export function createAdminServices(input: CreateAdminServicesInput): ContainerAdminServices {
  const { env, infra, repos, platform, complianceMedia, catalog, payments, bidding, userMisc } =
    input;
  const { redis, cache } = infra;
  const {
    lotRepo,
    paymentRepo,
    saleRepo,
    payoutRepository,
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
  const { paymentAdminService, xeroOAuthService, lotFulfilmentService, adminMetricsService } =
    payments;
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
    analyticsService,
    invitationService,
    adminPaymentListQueryService,
  } = userMisc;

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
    profileService,
    analyticsService,
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
    mediaUrlResolver,
    mediaAssetEnricher,
    amlService,
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
    adminLegalEntityBrowseReader,
    adminDisputeCaseEnrichmentReader,
    bidRepo: repoFactory.root.bid,
    env,
  });

  const adminLotsKpiTrendService = new AdminLotsKpiTrendService(lotRepo);
  const adminPaymentsKpiTrendService = new AdminPaymentsKpiTrendService(paymentRepo);
  const adminSalesKpiTrendService = new AdminSalesKpiTrendService(saleRepo);
  const adminPayoutsKpiTrendService = new AdminPayoutsKpiTrendService(payoutRepository);

  const adminNavCountsService = new AdminNavCountsService(
    createAdminNavCountsDeps({
      saleroomLiveSessionCounter: repos.saleroomLiveSessionCounter,
      admin: adminBase,
      repoFactory,
      conditionReportService,
      lotFulfilmentService,
      saleService,
      invitationService,
      amlService,
      sourceOfFundsService,
      telephoneBidBookingService,
    }),
    cache,
    30,
  );

  const admin = attachAdminDashboardMetrics(adminBase, {
    navCounts: adminNavCountsService,
    lotsKpiTrend: adminLotsKpiTrendService,
    paymentsKpiTrend: adminPaymentsKpiTrendService,
    salesKpiTrend: adminSalesKpiTrendService,
    payoutsKpiTrend: adminPayoutsKpiTrendService,
  });

  return {
    admin,
    adminNavCountsService,
    adminLotsKpiTrendService,
    adminPaymentsKpiTrendService,
    adminSalesKpiTrendService,
    adminPayoutsKpiTrendService,
  };
}
