import type { IBidRepository } from "@auction/persistence";
import type { Redis } from "ioredis";
import type { IAdminDomainEventReader } from "../../repositories/interfaces/admin-domain-event.reader.js";
import type { IAdminFinanceIssueSnapshotReader } from "../../repositories/interfaces/admin-finance-issue-snapshot.reader.js";
import type { IAdminLegalEntityBrowseReader } from "../../repositories/interfaces/admin-legal-entity-browse.reader.js";
import type { IAdminManualReviewPaymentEnrichmentReader } from "../../repositories/interfaces/admin-manual-review-payment-enrichment.reader.js";
import type { IAdminManualReviewPaymentReader } from "../../repositories/interfaces/admin-manual-review-payment.reader.js";
import type { IAdminOnboardingIssuesReader } from "../../repositories/interfaces/admin-onboarding-issues.reader.js";
import type { IAdminReviewTaskReader } from "../../repositories/interfaces/admin-review-task.reader.js";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { BidService } from "../bid.service.js";
import type { SaleroomOnBlockPolicy } from "../bid/saleroom-on-block.policy.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { AdminOperationsRouteServices } from "../interfaces/admin-routes/admin-operations-routes.js";
import type { IAnalyticsService } from "../interfaces/analytics.js";
import type { IAttentionFeedReader } from "../interfaces/attention-feed.js";
import type { IConveyorPipelineReader } from "../interfaces/conveyor-pipeline-reader.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IEmailObservabilityRepository } from "../interfaces/email-observability.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-service.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type { PaddleService } from "../paddle.service.js";
import type { SaleExpectedGuestsService } from "../sale-expected-guests.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import type { SaleroomService } from "../saleroom.service.js";
import type { TelephoneBidBookingService } from "../telephone-bid-booking.service.js";
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
  conveyorPipelineReader: IConveyorPipelineReader;
  itemSubmissionAdminApi: IItemSubmissionAdminApi;
  emailObservabilityRepository: IEmailObservabilityRepository;
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  saleroomService: SaleroomService;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
  bidService: BidService;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  paddleService: PaddleService;
  telephoneBidBookingService: TelephoneBidBookingService;
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
      input.conveyorPipelineReader,
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
