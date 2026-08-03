import type { PlaceBidWithIdempotencyOutcome } from "@auction/bidding-runtime";
import type {
  AttentionItem,
  EmailEventRow,
  EmailOutboxRow,
  EmailSuppressionRow,
  ListSubmissionsFilter,
  RedactedDomainEventRow,
} from "@auction/persistence/interfaces";
import type { Result } from "neverthrow";
import type { AdminReviewTaskRow } from "../../../admin/admin-route-dtos.js";
import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../../lib/admin-legal-entity-browse.js";
import type { AdminTodayMetrics } from "../../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../../admin-sale-operations-snapshot.service.js";
import type { AdminLegalEntityBrowsePage } from "../../admin/admin-legal-entity-browse-query.service.js";
import type {
  AdminOnboardingIssuesPage,
  AdminOnboardingIssuesPageRow,
} from "../../admin/admin-onboarding-issues-query.service.js";
import type { PaddleServiceError } from "../../paddle.service.js";
import type { SaleroomCheckInService } from "../../saleroom-check-in.service.js";
import type { AdminPaddleAssignInput, AdminPaddleClearInput } from "../admin-live-bidding-ports.js";
import type { IDisplayOverlayService } from "../display-overlay-service.js";
import type { IDisplayPairingService } from "../display-pairing-service.js";
import type {
  ISaleroomDisplayControlService,
  ISaleroomSessionControlService,
  ISaleroomSessionReadService,
} from "../saleroom-service.js";
import type {
  IAdminFinanceIssueSnapshotQueryService,
  IAdminManualReviewPaymentQueryService,
} from "./admin-finance-routes.js";
import type { IAdminTelephoneBookingApplicationService } from "./admin-telephone-booking-routes.js";

export type { RedactedDomainEventRow };

export interface IAdminDomainEventQueryService {
  listRedacted(input: {
    limit: number;
    offset?: number;
    eventTypePrefix?: string;
    aggregateType?: string;
    aggregateId?: string;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]>;
}

export type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
} from "../../../lib/admin-legal-entity-browse.js";

export interface IAdminOnboardingIssuesQueryService {
  getPage(input: {
    tab: import("@auction/persistence/interfaces").AdminOnboardingIssuesTab;
    limit: number;
    offset: number;
  }): Promise<AdminOnboardingIssuesPage>;
  getSelectedItem(input: {
    tab: import("@auction/persistence/interfaces").AdminOnboardingIssuesTab;
    id: string;
  }): Promise<AdminOnboardingIssuesPageRow | null>;
}

export interface IAdminReviewTaskQueryService {
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number>;
}

export interface IAdminLegalEntityBrowseQueryService {
  getPage(params: AdminLegalEntityBrowseParams): Promise<AdminLegalEntityBrowsePage>;
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
}

export interface IAdminEmailApplicationService {
  listOutbox(input: {
    status?: EmailOutboxRow["status"];
    limit: number;
    offset: number;
  }): Promise<EmailOutboxRow[]>;
  listEvents(input: { messageId: string }): Promise<EmailEventRow[]>;
  listSuppressions(input: { limit: number; offset: number }): Promise<EmailSuppressionRow[]>;
  deleteSuppression(input: { emailHash: string }): Promise<void>;
  deleteSuppressionsBulk(emailHashes: string[]): Promise<number>;
}

export interface IAdminOpsReadService {
  getTodayMetrics(): Promise<AdminTodayMetrics>;
  getBidsPerMinute(): Promise<number>;
  listAttentionFeed(): Promise<AttentionItem[]>;
  countPendingSubmissions(filter: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
  countQualityGapsForAdminApi(): Promise<number>;
  countSubmissionsBySellersForAdminApi(sellerIds: readonly string[]): Promise<number>;
}

export interface IAdminRequestLifecycleService {
  reconcileAdminRequestCookie(input: {
    actorUserId: string;
    cookieHeader: string | undefined;
  }): Promise<void>;
  isSuspended(userId: string): Promise<boolean>;
}

export interface IAdminSaleroomApplicationService {
  goLive: ISaleroomSessionControlService["goLive"];
  pause: ISaleroomSessionControlService["pause"];
  resume: ISaleroomSessionControlService["resume"];
  advanceToLot: ISaleroomSessionControlService["advanceToLot"];
  hammerCurrentLot: ISaleroomSessionControlService["hammerCurrentLot"];
  noSaleCurrentLot: ISaleroomSessionControlService["noSaleCurrentLot"];
  closeSession: ISaleroomSessionControlService["closeSession"];
  getSessionStatuses: ISaleroomSessionReadService["getSessionStatuses"];
  getSessionWithRecentEvents: ISaleroomSessionReadService["getSessionWithRecentEvents"];
  publishClerkPaddleBidSummary: ISaleroomDisplayControlService["publishClerkPaddleBidSummary"];
  getOperationsSnapshot: AdminSaleOperationsSnapshotService["getSnapshot"];
  listOperationsRadar: AdminSaleOperationsSnapshotService["listOperationsRadar"];
}

export interface IAdminSaleroomCheckInApplicationService {
  searchCandidates: SaleroomCheckInService["searchCandidates"];
  checkInBidder: SaleroomCheckInService["checkInBidder"];
  listExpectedGuests(saleId: string): Promise<import("@auction/types").SaleExpectedGuestsSummary>;
}

export type AdminLiveBiddingRateLimitError = {
  message: string;
  status: 429;
  code: "rate_limited";
};

export type AdminPlacePaddleBidResult =
  | PlaceBidWithIdempotencyOutcome
  | {
      type: "ok_with_summary";
      body: { data: { amount: string } };
      bidCount: number;
    };

export type ClerkPaddleBidHttpResult = {
  httpStatus: number;
  body: unknown;
};

export interface IAdminLiveBiddingApplicationService {
  placeClerkPaddleBid(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<ClerkPaddleBidHttpResult>;
  placePaddleBid(input: {
    saleId: string;
    lotId: string;
    paddleNumber: number;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<AdminPlacePaddleBidResult>;
  placeTelephoneBid(input: {
    lotId: string;
    buyerUserId: string;
    buyerLegalEntityId: string;
    amount: number;
    clerkUserId: string;
    maxAutoBidAmount?: number | undefined;
    telephoneBookingId?: string | undefined;
    idempotencyKey?: string | undefined;
  }): Promise<PlaceBidWithIdempotencyOutcome>;
  assignPaddle(
    input: AdminPaddleAssignInput,
  ): Promise<Result<{ paddleNumber: number }, PaddleServiceError | AdminLiveBiddingRateLimitError>>;
  clearPaddle(input: AdminPaddleClearInput): Promise<Result<void, PaddleServiceError>>;
  listSaleRoster(saleId: string): Promise<import("../../paddle.service.js").PaddleRosterEntry[]>;
}

export interface IAdminSaleroomDisplayService {
  approvePairing: IDisplayPairingService["approvePairing"];
  revokePairing: IDisplayPairingService["revokePairing"];
  listDevices: IDisplayPairingService["listDevices"];
  setOverlay: IDisplayOverlayService["setOverlay"];
  clearOverlay: IDisplayOverlayService["clearOverlay"];
}

export interface IAdminWorkItemsQueryService {
  listWorkItems(input: {
    actorUserId: string;
    actorRole: import("@auction/types").UserRole;
    actorStaffRole: import("@auction/types").UserStaffRole | null | undefined;
    query: import("@auction/validators").AdminWorkItemsQuery;
  }): Promise<import("@auction/validators").AdminWorkItemsResponseDto>;
}

export interface IAdminSaleReadinessQueryService {
  listReadiness(limit: number): Promise<import("@auction/validators").AdminSaleReadinessRowDto[]>;
}

export type AdminOperationsRouteServices = {
  requestLifecycle: IAdminRequestLifecycleService;
  ops: IAdminOpsReadService;
  workItems: IAdminWorkItemsQueryService;
  saleReadiness: IAdminSaleReadinessQueryService;
  domainEvents: IAdminDomainEventQueryService;
  financeIssueSnapshot: IAdminFinanceIssueSnapshotQueryService;
  manualReviewPayments: IAdminManualReviewPaymentQueryService;
  reviewTasks: IAdminReviewTaskQueryService;
  email: IAdminEmailApplicationService;
  display: IAdminSaleroomDisplayService;
  saleroom: IAdminSaleroomApplicationService;
  saleroomCheckIn: IAdminSaleroomCheckInApplicationService;
  liveBidding: IAdminLiveBiddingApplicationService;
  telephoneBookings: IAdminTelephoneBookingApplicationService;
};
