import type { IBidRepository } from "@auction/persistence/interfaces";
import type { IAdminDomainEventReader } from "@auction/persistence/interfaces";
import type { IAdminFinanceIssueSnapshotReader } from "@auction/persistence/interfaces";
import type { IAdminLegalEntityBrowseReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentEnrichmentReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentReader } from "@auction/persistence/interfaces";
import type { IAdminOnboardingIssuesReader } from "@auction/persistence/interfaces";
import type { IAdminReviewTaskReader } from "@auction/persistence/interfaces";
import type { IAttentionFeedReader } from "@auction/persistence/interfaces";
import type { IEmailObservabilityRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { BidService } from "../bid.service.js";
import type { SaleroomOnBlockPolicy } from "../bid/saleroom-on-block.policy.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { AdminOperationsRouteServices } from "../interfaces/admin-routes/admin-operations-routes.js";
import type { IAnalyticsService } from "../interfaces/analytics.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";
import type { SaleroomServicePort } from "../interfaces/saleroom-service.js";
import type { ITelephoneBidBookingBidPolicy } from "../interfaces/telephone-bid-booking-service.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type { PaddleService } from "../paddle.service.js";
import type { SaleExpectedGuestsService } from "../sale-expected-guests.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";
import { AdminDomainEventQueryService } from "./admin-domain-event-query.service.js";
import { AdminEmailApplicationService } from "./admin-email-application.service.js";
import { AdminFinanceIssueSnapshotQueryService } from "./admin-finance-issue-snapshot-query.service.js";
import { AdminLegalEntityBrowseQueryService } from "./admin-legal-entity-browse-query.service.js";
import { AdminLiveBiddingApplicationService } from "./admin-live-bidding-application.service.js";
import { AdminManualReviewPaymentQueryService } from "./admin-manual-review-payment-query.service.js";
import { AdminOnboardingIssuesQueryService } from "./admin-onboarding-issues-query.service.js";
import { AdminOpsReadApplicationService } from "./admin-ops-read-application.service.js";
import { AdminRequestLifecycleApplicationService } from "./admin-request-lifecycle-application.service.js";
import { AdminReviewTaskQueryService } from "./admin-review-task-query.service.js";
import { AdminSaleroomApplicationService } from "./admin-saleroom-application.service.js";
import { AdminSaleroomCheckInApplicationService } from "./admin-saleroom-check-in-application.service.js";
import { AdminSaleroomDisplayApplicationService } from "./admin-saleroom-display-application.service.js";

export type CreateAdminOperationsServicesInput = {
  impersonationAuditService: ImpersonationAuditService;
  userSuspensionChecker: IUserSuspensionChecker;
  analyticsService: IAnalyticsService;
  adminMetricsService: AdminMetricsService;
  attentionFeedReader: IAttentionFeedReader;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  emailObservabilityRepository: IEmailObservabilityRepository;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  saleroomService: SaleroomServicePort;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
  bidService: BidService;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  paddleService: PaddleService;
  telephoneBidBookingService: ITelephoneBidBookingBidPolicy;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
  adminDomainEventReader: IAdminDomainEventReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
  adminManualReviewPaymentReader: IAdminManualReviewPaymentReader;
  adminManualReviewPaymentEnrichmentReader: IAdminManualReviewPaymentEnrichmentReader;
  adminOnboardingIssuesReader: IAdminOnboardingIssuesReader;
  adminReviewTaskReader: IAdminReviewTaskReader;
  adminLegalEntityBrowseReader: IAdminLegalEntityBrowseReader;
  bidRepo: IBidRepository;
};

export type AdminOperationsServicesWithDomainEvents = AdminOperationsRouteServices & {
  domainEventsService: AdminDomainEventQueryService;
};

export function createAdminOperationsServices(
  input: CreateAdminOperationsServicesInput,
): AdminOperationsServicesWithDomainEvents {
  const domainEvents = new AdminDomainEventQueryService(input.adminDomainEventReader);
  return {
    domainEventsService: domainEvents,
    requestLifecycle: new AdminRequestLifecycleApplicationService(
      input.impersonationAuditService,
      input.userSuspensionChecker,
    ),
    ops: new AdminOpsReadApplicationService(
      input.analyticsService,
      input.adminMetricsService,
      input.attentionFeedReader,
      input.itemSubmissionAdminApi,
    ),
    domainEvents,
    dashboard: new AdminDashboardQueryService({
      financeIssueSnapshot: new AdminFinanceIssueSnapshotQueryService(
        input.adminFinanceIssueSnapshotReader,
      ),
      manualReviewPayments: new AdminManualReviewPaymentQueryService(
        input.adminManualReviewPaymentReader,
        input.adminManualReviewPaymentEnrichmentReader,
      ),
      onboardingIssues: new AdminOnboardingIssuesQueryService(input.adminOnboardingIssuesReader),
      reviewTasks: new AdminReviewTaskQueryService(input.adminReviewTaskReader),
      legalEntityBrowse: new AdminLegalEntityBrowseQueryService(input.adminLegalEntityBrowseReader),
    }),
    email: new AdminEmailApplicationService(input.emailObservabilityRepository),
    display: new AdminSaleroomDisplayApplicationService(
      input.displayPairingService,
      input.displayOverlayService,
    ),
    saleroom: new AdminSaleroomApplicationService(
      input.saleroomService,
      input.saleroomService,
      input.saleroomService,
      input.adminSaleOperationsSnapshotService,
    ),
    saleroomCheckIn: new AdminSaleroomCheckInApplicationService(
      input.saleroomCheckInService,
      input.saleExpectedGuestsService,
      input.redis,
    ),
    liveBidding: new AdminLiveBiddingApplicationService(
      input.bidService,
      input.saleroomOnBlockPolicy,
      input.paddleService,
      input.telephoneBidBookingService,
      input.adminMetricsService,
      input.bidRepo,
      input.redis,
      input.findLotById,
    ),
  };
}
