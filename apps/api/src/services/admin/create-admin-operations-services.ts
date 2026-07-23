import type { SaleroomOnBlockPolicy } from "@auction/bidding-runtime";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { IAdminDomainEventReader } from "@auction/persistence/interfaces";
import type { IAdminFinanceIssueSnapshotReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentEnrichmentReader } from "@auction/persistence/interfaces";
import type { IAdminManualReviewPaymentReader } from "@auction/persistence/interfaces";
import type { IAdminReviewTaskReader } from "@auction/persistence/interfaces";
import type { IAttentionFeedReader } from "@auction/persistence/interfaces";
import type { IEmailObservabilityRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { BidService } from "../bid.service.js";
import type { ImpersonationAuditService } from "../impersonation-audit.service.js";
import type { AdminOperationsRouteServices } from "../interfaces/admin-routes/admin-operations-routes.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IItemSubmissionAdminApi } from "../interfaces/item-submission-apis.js";
import type { SaleroomServicePort } from "../interfaces/saleroom-service.js";
import type {
  ITelephoneBidBookingBidPolicy,
  TelephoneBidBookingServicePort,
} from "../interfaces/telephone-bid-booking-service.js";
import type { IUserSuspensionChecker } from "../interfaces/user-suspension.js";
import type { PaddleService } from "../paddle.service.js";
import type { SaleExpectedGuestsService } from "../sale-expected-guests.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import { AdminDomainEventQueryService } from "./admin-domain-event-query.service.js";
import { AdminEmailApplicationService } from "./admin-email-application.service.js";
import { AdminFinanceIssueSnapshotQueryService } from "./admin-finance-issue-snapshot-query.service.js";
import { AdminManualReviewPaymentQueryService } from "./admin-manual-review-payment-query.service.js";
import { AdminOpsReadApplicationService } from "./admin-ops-read-application.service.js";
import { AdminRequestLifecycleApplicationService } from "./admin-request-lifecycle-application.service.js";
import { AdminReviewTaskQueryService } from "./admin-review-task-query.service.js";
import { AdminTelephoneBookingApplicationService } from "./admin-telephone-booking-application.service.js";
import {
  createAdminSaleroomRouteServices,
  paddleServiceAsClerkOperations,
} from "./create-admin-saleroom-route-services.js";

export type CreateAdminOperationsServicesInput = {
  impersonationAuditService: ImpersonationAuditService;
  userSuspensionChecker: IUserSuspensionChecker;
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
  telephoneBidBookingService: TelephoneBidBookingServicePort;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
  adminDomainEventReader: IAdminDomainEventReader;
  adminFinanceIssueSnapshotReader: IAdminFinanceIssueSnapshotReader;
  adminManualReviewPaymentReader: IAdminManualReviewPaymentReader;
  adminManualReviewPaymentEnrichmentReader: IAdminManualReviewPaymentEnrichmentReader;
  adminReviewTaskReader: IAdminReviewTaskReader;
  bidRepo: IBidRepository;
};

export type AdminOperationsServicesWithDomainEvents = AdminOperationsRouteServices & {
  domainEventsService: AdminDomainEventQueryService;
};

export function createAdminOperationsServices(
  input: CreateAdminOperationsServicesInput,
): AdminOperationsServicesWithDomainEvents {
  const domainEvents = new AdminDomainEventQueryService(input.adminDomainEventReader);
  const saleroomRoutes = createAdminSaleroomRouteServices({
    displayPairingService: input.displayPairingService,
    displayOverlayService: input.displayOverlayService,
    saleroomService: input.saleroomService,
    adminSaleOperationsSnapshotService: input.adminSaleOperationsSnapshotService,
    saleroomCheckInService: input.saleroomCheckInService,
    saleExpectedGuestsService: input.saleExpectedGuestsService,
    bidPlacer: input.bidService,
    saleroomOnBlockPolicy: input.saleroomOnBlockPolicy,
    paddleClerk: paddleServiceAsClerkOperations(input.paddleService),
    telephoneBidBookingService: input.telephoneBidBookingService as ITelephoneBidBookingBidPolicy,
    adminMetricsService: input.adminMetricsService,
    bidRepo: input.bidRepo,
    redis: input.redis,
    findLotById: input.findLotById,
  });

  return {
    domainEventsService: domainEvents,
    requestLifecycle: new AdminRequestLifecycleApplicationService(
      input.impersonationAuditService,
      input.userSuspensionChecker,
    ),
    ops: new AdminOpsReadApplicationService(
      input.adminMetricsService,
      input.attentionFeedReader,
      input.itemSubmissionAdminApi,
    ),
    domainEvents,
    financeIssueSnapshot: new AdminFinanceIssueSnapshotQueryService(
      input.adminFinanceIssueSnapshotReader,
    ),
    manualReviewPayments: new AdminManualReviewPaymentQueryService(
      input.adminManualReviewPaymentReader,
      input.adminManualReviewPaymentEnrichmentReader,
    ),
    reviewTasks: new AdminReviewTaskQueryService(input.adminReviewTaskReader),
    email: new AdminEmailApplicationService(input.emailObservabilityRepository),
    telephoneBookings: new AdminTelephoneBookingApplicationService(
      input.telephoneBidBookingService,
      input.telephoneBidBookingService,
    ),
    ...saleroomRoutes,
  };
}
