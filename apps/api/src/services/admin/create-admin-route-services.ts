import type { Database } from "@auction/db";
import type { Redis } from "ioredis";
import type { Env } from "../../env.js";
import type { PlatformCatalogLegalEntityIdProvider } from "../../lib/platform-catalog-legal-entity.js";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { AmlService } from "../aml/aml.service.js";
import type { ArtistProfileService } from "../artist-profile.service.js";
import type { BidService } from "../bid.service.js";
import type { SaleroomOnBlockPolicy } from "../bid/saleroom-on-block.policy.js";
import type { CategoryService } from "../category.service.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { ImpersonationSessionService } from "../impersonation-session.service.js";
import type { AdminRouteServices } from "../interfaces/admin-routes.js";
import type { IAnalyticsService } from "../interfaces/analytics.js";
import type { IArtistRegistryService } from "../interfaces/artist-registry.js";
import type { IAttentionFeedReader } from "../interfaces/attention-feed.js";
import type { IConditionReportService } from "../interfaces/condition-report.js";
import type { IConveyorPipelineReader } from "../interfaces/conveyor-pipeline-reader.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IEmailObservabilityRepository } from "../interfaces/email-observability.js";
import type { IItemSubmissionService } from "../interfaces/item-submission-service.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { IStripeConnectService } from "../interfaces/stripe-connect.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type {
  IPaymentExternalRefRepository,
  IXeroConnectionRepository,
  IXeroWebhookEventRepository,
} from "../interfaces/xero-repositories.js";
import type { InvitationService } from "../invitation.service.js";
import type { LegalEntityLifecycleAdminService } from "../legal-entity-lifecycle-admin.service.js";
import type { LotFulfilmentService } from "../lot-fulfilment.service.js";
import type { LotLifecycleQueryService } from "../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../lot-transition-orchestrator.js";
import type { LotService } from "../lot.service.js";
import type { MediaAssetEnricher } from "../media-asset-enricher.js";
import type { MediaUrlResolver } from "../media-url-resolver.js";
import type { PaddleService } from "../paddle.service.js";
import type { PaymentService } from "../payment.service.js";
import type { ProfileService } from "../profile.service.js";
import type { QrCodeAnalyticsService } from "../qr-code-analytics.service.js";
import type { QrCodeService } from "../qr-code.service.js";
import type { SaleRegistrationService } from "../sale-registration.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import type { SaleroomService } from "../saleroom.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { TelephoneBidBookingService } from "../telephone-bid-booking.service.js";
import type { XeroOAuthService } from "../xero-oauth.service.js";
import { AdminAmlApplicationService } from "./admin-aml-application.service.js";
import { AdminCatalogApplicationService } from "./admin-catalog-application.service.js";
import { AdminConditionReportsApplicationService } from "./admin-condition-reports-application.service.js";
import { AdminDashboardMetricsApplicationService } from "./admin-dashboard-metrics-application.service.js";
import { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";
import { AdminDisputeCaseQueryService } from "./admin-dispute-case-query.service.js";
import { AdminDomainEventQueryService } from "./admin-domain-event-query.service.js";
import { AdminEmailApplicationService } from "./admin-email-application.service.js";
import { AdminImpersonationService } from "./admin-impersonation.service.js";
import { AdminInvitationApplicationService } from "./admin-invitation-application.service.js";
import { AdminLegalEntityLifecycleApplicationService } from "./admin-legal-entity-lifecycle-application.service.js";
import { AdminLiveBiddingApplicationService } from "./admin-live-bidding-application.service.js";
import type { AdminLotBrowseService } from "./admin-lot-browse.service.js";
import { AdminLotFulfilmentApplicationService } from "./admin-lot-fulfilment-application.service.js";
import { AdminLotsApplicationService } from "./admin-lots-application.service.js";
import type { AdminLotsKpiTrendService } from "./admin-lots-kpi-trend.service.js";
import type { AdminNavCountsService } from "./admin-nav-counts.service.js";
import { AdminOpsReadApplicationService } from "./admin-ops-read-application.service.js";
import type { AdminPaymentListQueryService } from "./admin-payment-list-query.service.js";
import { AdminPaymentsApplicationService } from "./admin-payments-application.service.js";
import type { AdminPaymentsKpiTrendService } from "./admin-payments-kpi-trend.service.js";
import type { AdminPayoutsKpiTrendService } from "./admin-payouts-kpi-trend.service.js";
import { AdminQrCodesApplicationService } from "./admin-qr-codes-application.service.js";
import { AdminRequestLifecycleApplicationService } from "./admin-request-lifecycle-application.service.js";
import { AdminSaleRegistrationsApplicationService } from "./admin-sale-registrations-application.service.js";
import { AdminSaleroomApplicationService } from "./admin-saleroom-application.service.js";
import { AdminSaleroomCheckInApplicationService } from "./admin-saleroom-check-in-application.service.js";
import { AdminSaleroomDisplayApplicationService } from "./admin-saleroom-display-application.service.js";
import type { AdminSalesKpiTrendService } from "./admin-sales-kpi-trend.service.js";
import { AdminSourceOfFundsApplicationService } from "./admin-source-of-funds-application.service.js";
import type { AdminSourceOfFundsQueryService } from "./admin-source-of-funds-query.service.js";
import { AdminStripeConnectApplicationService } from "./admin-stripe-connect-application.service.js";
import { AdminUserApplicationService } from "./admin-user-application.service.js";
import { AdminXeroApplicationService } from "./admin-xero-application.service.js";
import type { LegalEntityDocumentAdminService } from "./legal-entity-document-admin.service.js";

export type AdminRouteServicesCore = Omit<AdminRouteServices, "dashboardMetrics">;

export type CreateAdminRouteServicesInput = {
  db: Database;
  domainEventPublisher: DomainEventPublisher;
  impersonationSessionService: ImpersonationSessionService;
  impersonationAuditService: ImpersonationAuditService;
  userSuspensionChecker: IUserSuspensionChecker;
  legalEntityRepository: ILegalEntityRepository;
  legalEntityLifecycleAdminService: LegalEntityLifecycleAdminService;
  legalEntityDocumentAdminService: LegalEntityDocumentAdminService;
  categoryService: CategoryService;
  artistProfileService: ArtistProfileService;
  emailObservabilityRepository: IEmailObservabilityRepository;
  adminUserService: AdminUserService;
  profileService: ProfileService;
  analyticsService: IAnalyticsService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  conveyorPipelineReader: IConveyorPipelineReader;
  itemSubmissionService: IItemSubmissionService;
  paymentService: PaymentService;
  adminPaymentListQueryService: AdminPaymentListQueryService;
  lotService: LotService;
  adminLotBrowseService: AdminLotBrowseService;
  lotTransitionOrchestrator: LotTransitionOrchestrator;
  lotLifecycleQueryService: LotLifecycleQueryService;
  saleRegistrationService: SaleRegistrationService;
  artistRegistryService: IArtistRegistryService;
  resolvePlatformCatalogLegalEntityId: PlatformCatalogLegalEntityIdProvider;
  invitationService: InvitationService;
  xeroOAuthService: XeroOAuthService | null;
  xeroConnectionRepository: IXeroConnectionRepository;
  xeroWebhookEventRepository: IXeroWebhookEventRepository;
  paymentExternalRefRepository: IPaymentExternalRefRepository;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  qrCodeService: QrCodeService;
  qrCodeAnalytics: QrCodeAnalyticsService;
  conditionReportService: IConditionReportService;
  mediaUrlResolver: MediaUrlResolver;
  mediaAssetEnricher: MediaAssetEnricher;
  amlService: AmlService;
  adminSourceOfFundsQueryService: AdminSourceOfFundsQueryService;
  sourceOfFundsService: SourceOfFundsService;
  sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService;
  sourceOfFundsDocumentReviewService: SourceOfFundsDocumentReviewService;
  stripeConnectService: IStripeConnectService;
  saleroomService: SaleroomService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomCheckInService: SaleroomCheckInService;
  lotFulfilmentService: LotFulfilmentService;
  bidService: BidService;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  paddleService: PaddleService;
  telephoneBidBookingService: TelephoneBidBookingService;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
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
  const domainEvents = new AdminDomainEventQueryService(input.db);
  return {
    requestLifecycle: new AdminRequestLifecycleApplicationService(
      input.impersonationAuditService,
      input.userSuspensionChecker,
    ),
    ops: new AdminOpsReadApplicationService(
      input.analyticsService,
      input.adminMetricsService,
      input.attentionFeedReader,
      input.itemSubmissionService,
      input.conveyorPipelineReader,
    ),
    impersonation: new AdminImpersonationService(
      input.db,
      input.legalEntityRepository,
      input.impersonationSessionService,
      input.domainEventPublisher,
    ),
    domainEvents,
    disputeCases: new AdminDisputeCaseQueryService(domainEvents, input.db),
    dashboard: new AdminDashboardQueryService(input.db),
    catalog: new AdminCatalogApplicationService(
      input.categoryService,
      input.artistProfileService,
      input.artistRegistryService,
      input.resolvePlatformCatalogLegalEntityId,
    ),
    email: new AdminEmailApplicationService(input.emailObservabilityRepository),
    users: new AdminUserApplicationService(input.adminUserService, input.profileService),
    payments: new AdminPaymentsApplicationService(
      input.paymentService,
      input.adminPaymentListQueryService,
    ),
    lots: new AdminLotsApplicationService(
      input.lotService,
      input.adminLotBrowseService,
      input.lotTransitionOrchestrator,
      input.lotLifecycleQueryService,
    ),
    invitations: new AdminInvitationApplicationService(input.invitationService),
    legalEntityLifecycle: new AdminLegalEntityLifecycleApplicationService(
      input.legalEntityRepository,
      input.legalEntityLifecycleAdminService,
      input.legalEntityDocumentAdminService,
    ),
    xero: new AdminXeroApplicationService(
      input.xeroOAuthService,
      input.env.XERO_REDIRECT_URI,
      input.xeroConnectionRepository,
      input.xeroWebhookEventRepository,
      input.paymentExternalRefRepository,
      input.db,
      input.env,
    ),
    display: new AdminSaleroomDisplayApplicationService(
      input.displayPairingService,
      input.displayOverlayService,
    ),
    qrCodes: new AdminQrCodesApplicationService(input.qrCodeService, input.qrCodeAnalytics),
    conditionReports: new AdminConditionReportsApplicationService(
      input.conditionReportService,
      input.mediaUrlResolver,
      input.mediaAssetEnricher,
    ),
    aml: new AdminAmlApplicationService(input.amlService),
    sourceOfFunds: new AdminSourceOfFundsApplicationService(
      input.adminSourceOfFundsQueryService,
      input.sourceOfFundsService,
      input.sourceOfFundsDocumentCollectionService,
      input.sourceOfFundsDocumentReviewService,
      {
        WEB_ORIGIN: input.env.WEB_ORIGIN,
        WEB_ORIGINS: input.env.WEB_ORIGINS,
        SSR_TRUSTED_ORIGINS: input.env.SSR_TRUSTED_ORIGINS,
      },
    ),
    saleRegistrations: new AdminSaleRegistrationsApplicationService(input.saleRegistrationService),
    stripeConnect: new AdminStripeConnectApplicationService(
      input.stripeConnectService,
      input.env.WEB_ORIGIN,
    ),
    saleroom: new AdminSaleroomApplicationService(
      input.saleroomService,
      input.adminSaleOperationsSnapshotService,
    ),
    saleroomCheckIn: new AdminSaleroomCheckInApplicationService(
      input.saleroomCheckInService,
      input.redis,
    ),
    lotFulfilment: new AdminLotFulfilmentApplicationService(input.lotFulfilmentService),
    liveBidding: new AdminLiveBiddingApplicationService(
      input.bidService,
      input.saleroomOnBlockPolicy,
      input.paddleService,
      input.telephoneBidBookingService,
      input.adminMetricsService,
      input.db,
      input.redis,
      input.findLotById,
    ),
  };
}

export type AttachAdminDashboardMetricsInput = {
  navCounts: AdminNavCountsService;
  lotsKpiTrend: AdminLotsKpiTrendService;
  paymentsKpiTrend: AdminPaymentsKpiTrendService;
  salesKpiTrend: AdminSalesKpiTrendService;
  payoutsKpiTrend: AdminPayoutsKpiTrendService;
};

/** Nav counts depend on `admin` (circular); attach dashboard metrics after both are built. */
export function attachAdminDashboardMetrics(
  admin: AdminRouteServicesCore,
  metrics: AttachAdminDashboardMetricsInput,
): AdminRouteServices {
  return {
    ...admin,
    dashboardMetrics: new AdminDashboardMetricsApplicationService(
      metrics.navCounts,
      metrics.lotsKpiTrend,
      metrics.paymentsKpiTrend,
      metrics.salesKpiTrend,
      metrics.payoutsKpiTrend,
    ),
  };
}
