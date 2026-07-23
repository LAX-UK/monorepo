import type { SaleroomOnBlockPolicy } from "@auction/bidding-runtime";
import type { IUserInvitationRepository } from "@auction/persistence/interfaces";
import type { IBidRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILotFulfilmentRepository } from "@auction/persistence/interfaces";
import type {
  IAdminDisputeCaseEnrichmentReader,
  IImpersonationSessionRepository,
} from "@auction/persistence/interfaces";
import type { IWatchlistScreeningReader } from "@auction/persistence/interfaces";
import type { IAdminDomainEventReader } from "@auction/persistence/interfaces";
import type { IAdminFinanceIssueSnapshotReader } from "@auction/persistence/interfaces";
import type { IAdminLegalEntityBrowseReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentEnrichmentReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentReader } from "@auction/persistence/interfaces";
import type { IAdminOnboardingIssuesReader } from "@auction/persistence/interfaces";
import type { IAdminReviewTaskReader } from "@auction/persistence/interfaces";
import type { IImpersonationDomainEventReader } from "@auction/persistence/interfaces";
import type { IAttentionFeedReader } from "@auction/persistence/interfaces";
import type { IEmailObservabilityRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { Env } from "../../env.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { AmlService } from "../aml/aml.service.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { BidService } from "../bid.service.js";
import type { CategoryService } from "../category.service.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type {
  AdminMetricsQueryServices,
  AdminRouteServicesWithoutSatellites,
} from "../interfaces/admin-routes.js";
import type { IArtistRegistryService } from "../interfaces/artist-registry.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IPayoutStatementApplicationService } from "../interfaces/finance-routes/finance-payout-statement.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";
import type { ILotFulfilmentService } from "../interfaces/lot-fulfilment-service.js";
import type { ILotService } from "../interfaces/lot-service.js";
import type { IPaymentAdminService } from "../interfaces/payment-service.js";
import type { IPayoutAdminService, IPayoutSettlementService } from "../interfaces/payout.js";
import type { ISaleRegistrationService } from "../interfaces/sale-registration-service.js";
import type { SaleroomServicePort } from "../interfaces/saleroom-service.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { TelephoneBidBookingServicePort } from "../interfaces/telephone-bid-booking-service.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type { InvitationService } from "../invitation.service.js";
import type { LegalEntityLifecycleAdminService } from "../legal-entity-lifecycle-admin.service.js";
import type { LotLifecycleQueryService } from "../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../lot-transition-orchestrator.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { PaddleService } from "../paddle.service.js";
import type { ProfileService } from "../profile.service.js";
import type { QrCodeAnalyticsService } from "../qr-code-analytics.service.js";
import type { QrCodeService } from "../qr-code.service.js";
import type { SaleExpectedGuestsService } from "../sale-expected-guests.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import { AdminDashboardMetricsApplicationService } from "./admin-dashboard-metrics-application.service.js";
import type { AdminLotAttentionService } from "./admin-lot-attention.service.js";
import type { AdminLotBrowseService } from "./admin-lot-browse.service.js";
import { AdminLotDetailBoardApplicationService } from "./admin-lot-detail-board-application.service.js";
import type { AdminLotDetailMetricsService } from "./admin-lot-detail-metrics.service.js";
import type { AdminLotOverviewKpiTrendService } from "./admin-lot-overview-kpi-trend.service.js";
import type { AdminLotsEndedKpiTrendService } from "./admin-lots-ended-kpi-trend.service.js";
import type { AdminLotsHammerKpiTrendService } from "./admin-lots-hammer-kpi-trend.service.js";
import type { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";
import type { AdminLotsListSummaryService } from "./admin-lots-list-summary.service.js";
import type { AdminNavCountsService } from "./admin-nav-counts.service.js";
import type { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";
import type { AdminPaymentsKpiTrendService } from "./admin-payments-kpi-trend.service.js";
import type { AdminPayoutsKpiTrendService } from "./admin-payouts-kpi-trend.service.js";
import type { AdminSaleAttentionService } from "./admin-sale-attention.service.js";
import { AdminSaleDetailBoardApplicationService } from "./admin-sale-detail-board-application.service.js";
import type { AdminSaleDetailMetricsService } from "./admin-sale-detail-metrics.service.js";
import type { AdminSaleOverviewKpiTrendService } from "./admin-sale-overview-kpi-trend.service.js";
import type { AdminSalesKpiTrendService } from "./admin-sales-kpi-trend.service.js";
import type { AdminSalesListSummaryService } from "./admin-sales-list-summary.service.js";
import type { AdminSourceOfFundsQueryService } from "./admin-source-of-funds-query.service.js";
import type { AdminSubmissionsListSummaryService } from "./admin-submissions-list-summary.service.js";
import { createAdminCatalogServices } from "./create-admin-catalog-services.js";
import { createAdminComplianceServices } from "./create-admin-compliance-services.js";
import { createAdminFinanceServices } from "./create-admin-finance-services.js";
import { createAdminOperationsServices } from "./create-admin-operations-services.js";
import { createAdminPeopleServices } from "./create-admin-people-services.js";
import type { LegalEntityDocumentAdminService } from "./legal-entity-document-admin.service.js";

export type AdminRouteServicesCore = Omit<
  AdminRouteServicesWithoutSatellites,
  "navCounts" | "kpiTrends" | "listSummaries" | "saleDetailBoard" | "lotDetailBoard"
>;

export type CreateAdminRouteServicesInput = {
  transactionRunner: ITransactionRunner;
  domainEventSink: IDomainEventSink;
  impersonationSessionRepository: IImpersonationSessionRepository;
  impersonationDomainEventReader: IImpersonationDomainEventReader;
  impersonationAuditService: ImpersonationAuditService;
  userSuspensionChecker: IUserSuspensionChecker;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  adminUserService: AdminUserService;
  adminUserReader: import("@auction/persistence/interfaces").IAdminUserReader;
  profileService: ProfileService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  paymentService: IPaymentAdminService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  lotService: ILotService;
  adminLotBrowseService: AdminLotBrowseService;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotLifecycleQueryService: LotLifecycleQueryService;
  saleRegistrationService: ISaleRegistrationService;
  artistRegistryService: IArtistRegistryService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  invitationService: InvitationService;
  invitationRepository: IUserInvitationRepository;
  xeroOAuthService: XeroOAuthService | null;
  xeroConnectionRepository: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  paymentExternalRefRepository: IPaymentExternalRefRepository;
  userRepository: IUserRepository;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  conditionReportService: IConditionReportService;
  conditionReportRequestRepository: IConditionReportRequestRepository;
  mediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
  amlService: AmlService;
  amlScreeningReader: IWatchlistScreeningReader;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsService: SourceOfFundsService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  stripeConnectService: IStripeConnectService;
  saleroomService: SaleroomServicePort;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
  lotFulfilmentService: ILotFulfilmentService;
  lotFulfilmentRepository: ILotFulfilmentRepository;
  bidService: BidService;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  paddleService: PaddleService;
  telephoneBidBookingService: TelephoneBidBookingServicePort;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
  adminDomainEventReader: IAdminDomainEventReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
  adminManualReviewPaymentReader: IAdminManualReviewPaymentReader;
  adminManualReviewPaymentEnrichmentReader: IAdminManualReviewPaymentEnrichmentReader;
  adminOnboardingIssuesReader: IAdminOnboardingIssuesReader;
  adminReviewTaskReader: IAdminReviewTaskReader;
  adminLegalEntityBrowseReader: IAdminLegalEntityBrowseReader;
  adminDisputeCaseEnrichmentReader: IAdminDisputeCaseEnrichmentReader;
  bidRepo: IBidRepository;
  payoutService: IPayoutAdminService;
  payoutSettlementService: IPayoutSettlementService;
  payoutStatementApplication: IPayoutStatementApplicationService;
  env: Pick<
    Env,
    | "XERO_REDIRECT_URI"
    | "API_PUBLIC_URL"
    | "XERO_WEBHOOK_KEY"
    | "WEB_ORIGIN"
    | "WEB_ORIGINS"
    | "SSR_TRUSTED_ORIGINS"
  >;
};

export function createAdminRouteServices(
  input: CreateAdminRouteServicesInput,
): AdminRouteServicesCore {
  const operations = createAdminOperationsServices({
    impersonationAuditService: input.impersonationAuditService,
    userSuspensionChecker: input.userSuspensionChecker,
    adminMetricsService: input.adminMetricsService,
    attentionFeedReader: input.attentionFeedReader,
    itemSubmissionAdminApi: input.itemSubmissionAdminApi,
    emailObservabilityRepository: input.emailObservabilityRepository,
    displayPairingService: input.displayPairingService,
    displayOverlayService: input.displayOverlayService,
    saleroomService: input.saleroomService,
    adminSaleOperationsSnapshotService: input.adminSaleOperationsSnapshotService,
    saleroomCheckInService: input.saleroomCheckInService,
    saleExpectedGuestsService: input.saleExpectedGuestsService,
    bidService: input.bidService,
    saleroomOnBlockPolicy: input.saleroomOnBlockPolicy,
    paddleService: input.paddleService,
    telephoneBidBookingService: input.telephoneBidBookingService,
    redis: input.redis,
    findLotById: input.findLotById,
    adminDomainEventReader: input.adminDomainEventReader,
    adminFinanceIssueSnapshotReader: input.adminFinanceIssueSnapshotReader,
    adminManualReviewPaymentReader: input.adminManualReviewPaymentReader,
    adminManualReviewPaymentEnrichmentReader: input.adminManualReviewPaymentEnrichmentReader,
    adminReviewTaskReader: input.adminReviewTaskReader,
    bidRepo: input.bidRepo,
  });

  const catalog = createAdminCatalogServices({
    categoryService: input.categoryService,
    artistProfileService: input.artistProfileService,
    artistRegistryService: input.artistRegistryService,
    resolvePlatformCatalogLegalEntityId: input.resolvePlatformCatalogLegalEntityId,
    lotService: input.lotService,
    adminLotBrowseService: input.adminLotBrowseService,
    lotTransitionOrchestrator: input.lotTransitionOrchestrator,
    lotLifecycleQueryService: input.lotLifecycleQueryService,
    saleRegistrationService: input.saleRegistrationService,
    lotFulfilmentService: input.lotFulfilmentService,
    lotFulfilmentRepository: input.lotFulfilmentRepository,
    qrCodeService: input.qrCodeService,
    qrCodeAnalytics: input.qrCodeAnalytics,
    conditionReportService: input.conditionReportService,
    conditionReportRequestRepository: input.conditionReportRequestRepository,
    mediaUrlResolver: input.mediaUrlResolver,
    mediaAssetEnricher: input.mediaAssetEnricher,
  });

  const finance = createAdminFinanceServices({
    paymentService: input.paymentService,
    adminPaymentListQueryService: input.adminPaymentListQueryService,
    stripeConnectService: input.stripeConnectService,
    xeroOAuthService: input.xeroOAuthService,
    xeroConnectionRepository: input.xeroConnectionRepository,
    xeroWebhookEventRepository: input.xeroWebhookEventRepository,
    paymentExternalRefRepository: input.paymentExternalRefRepository,
    userRepository: input.userRepository,
    payoutService: input.payoutService,
    payoutSettlementService: input.payoutSettlementService,
    payoutStatementApplication: input.payoutStatementApplication,
    env: input.env,
  });

  const compliance = createAdminComplianceServices({
    domainEvents: operations.domainEvents,
    legalEntityRepository: input.legalEntityRepository,
    legalEntityLifecycleAdminService: input.legalEntityLifecycleAdminService,
    legalEntityDocumentAdminService: input.legalEntityDocumentAdminService,
    adminDisputeCaseEnrichmentReader: input.adminDisputeCaseEnrichmentReader,
    amlService: input.amlService,
    amlScreeningReader: input.amlScreeningReader,
    adminSourceOfFundsQueryService: input.adminSourceOfFundsQueryService,
    sourceOfFundsService: input.sourceOfFundsService,
    sourceOfFundsDocumentCollectionService: input.sourceOfFundsDocumentCollectionService,
    sourceOfFundsDocumentReviewService: input.sourceOfFundsDocumentReviewService,
    env: input.env,
  });

  const people = createAdminPeopleServices({
    transactionRunner: input.transactionRunner,
    domainEventSink: input.domainEventSink,
    impersonationSessionRepository: input.impersonationSessionRepository,
    impersonationDomainEventReader: input.impersonationDomainEventReader,
    legalEntityRepository: input.legalEntityRepository,
    adminUserService: input.adminUserService,
    adminUserReader: input.adminUserReader,
    profileService: input.profileService,
    invitationService: input.invitationService,
    invitationRepository: input.invitationRepository,
    adminLegalEntityBrowseReader: input.adminLegalEntityBrowseReader,
    adminOnboardingIssuesReader: input.adminOnboardingIssuesReader,
    adminFinanceIssueSnapshotReader: input.adminFinanceIssueSnapshotReader,
  });

  const { domainEventsService: _domainEventsService, ...operationsServices } = operations;

  return {
    ...catalog,
    ...finance,
    ...compliance,
    ...people,
    ...operationsServices,
  };
}

export type AttachAdminDashboardMetricsInput = {
  navCounts: AdminNavCountsService;
  lotsKpiTrend: AdminLotsKpiTrendService;
  lotsEndedKpiTrend: AdminLotsEndedKpiTrendService;
  lotsHammerKpiTrend: AdminLotsHammerKpiTrendService;
  paymentsKpiTrend: AdminPaymentsKpiTrendService;
  salesKpiTrend: AdminSalesKpiTrendService;
  payoutsKpiTrend: AdminPayoutsKpiTrendService;
  salesListSummary: AdminSalesListSummaryService;
  lotsListSummary: AdminLotsListSummaryService;
  submissionsListSummary: AdminSubmissionsListSummaryService;
};

export type AdminRouteServicesWithMetrics = AdminRouteServicesCore & AdminMetricsQueryServices;

/** Attach metrics query ports after nav-count deps are wired. */
export function attachAdminMetricsQueries(
  admin: AdminRouteServicesCore,
  metrics: AttachAdminDashboardMetricsInput,
): AdminRouteServicesWithMetrics {
  const metricsFacade = new AdminDashboardMetricsApplicationService(
    metrics.navCounts,
    metrics.lotsKpiTrend,
    metrics.lotsEndedKpiTrend,
    metrics.lotsHammerKpiTrend,
    metrics.paymentsKpiTrend,
    metrics.salesKpiTrend,
    metrics.payoutsKpiTrend,
    metrics.salesListSummary,
    metrics.lotsListSummary,
    metrics.submissionsListSummary,
  );
  return {
    ...admin,
    navCounts: metricsFacade,
    kpiTrends: metricsFacade,
    listSummaries: metricsFacade,
  };
}

/** @deprecated Use attachAdminMetricsQueries */
export function attachAdminDashboardMetrics(
  admin: AdminRouteServicesCore,
  metrics: AttachAdminDashboardMetricsInput,
): AdminRouteServicesWithMetrics {
  return attachAdminMetricsQueries(admin, metrics);
}

export type AdminRouteServicesWithDashboardMetrics = AdminRouteServicesWithMetrics;

export type AttachAdminDetailBoardInput = {
  saleDetailMetrics: AdminSaleDetailMetricsService;
  saleOverviewKpiTrend: AdminSaleOverviewKpiTrendService;
  saleAttention: AdminSaleAttentionService;
  lotDetailMetrics: AdminLotDetailMetricsService;
  lotOverviewKpiTrend: AdminLotOverviewKpiTrendService;
  lotAttention: AdminLotAttentionService;
};

export function attachAdminDetailBoardServices(
  admin: AdminRouteServicesWithMetrics,
  detail: AttachAdminDetailBoardInput,
): AdminRouteServicesWithoutSatellites {
  return {
    ...admin,
    saleDetailBoard: new AdminSaleDetailBoardApplicationService(
      detail.saleDetailMetrics,
      detail.saleOverviewKpiTrend,
      detail.saleAttention,
    ),
    lotDetailBoard: new AdminLotDetailBoardApplicationService(
      detail.lotDetailMetrics,
      detail.lotOverviewKpiTrend,
      detail.lotAttention,
    ),
  };
}

export {
  createAdminCatalogServices,
  createAdminComplianceServices,
  createAdminFinanceServices,
  createAdminOperationsServices,
  createAdminPeopleServices,
};
