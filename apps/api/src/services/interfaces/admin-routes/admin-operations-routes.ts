import type { EmailOutboxStatus } from "@auction/db/schema";
import type { ItemSubmissionStatus, LotStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { AdminOnboardingIssues, AdminReviewTaskRow } from "../../../admin/admin-route-dtos.js";
import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../../lib/admin-legal-entity-browse.js";
import type { AdminTodayMetrics } from "../../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../../admin-sale-operations-snapshot.service.js";
import type { PlaceBidWithIdempotencyOutcome } from "../../bid/place-bid-idempotency.js";
import type { PaddleService, PaddleServiceError } from "../../paddle.service.js";
import type { SaleroomCheckInService } from "../../saleroom-check-in.service.js";
import type { SaleroomService } from "../../saleroom.service.js";
import type { AdminAnalyticsDashboard, DateRange } from "../analytics.js";
import type { AttentionItem } from "../attention-feed.js";
import type { IDisplayOverlayService } from "../display-overlay-service.js";
import type { IDisplayPairingService } from "../display-pairing-service.js";
import type { EmailEventRow, EmailOutboxRow, EmailSuppressionRow } from "../email-observability.js";
import type { ListSubmissionsFilter } from "../repositories.js";
import type { IAdminFinanceDashboardQueryService } from "./admin-finance-routes.js";

export type RedactedDomainEventRow = {
  id: number;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: unknown;
  actorUserId: string | null;
  actingLegalEntityId: string | null;
  occurredAt: Date;
};

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

export interface IAdminDashboardQueryService extends IAdminFinanceDashboardQueryService {
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
  getOnboardingIssues(): Promise<AdminOnboardingIssues>;
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number>;
}

export interface IAdminEmailApplicationService {
  listOutbox(input: {
    status?: EmailOutboxStatus;
    limit: number;
    offset: number;
  }): Promise<EmailOutboxRow[]>;
  listEvents(input: { messageId: string }): Promise<EmailEventRow[]>;
  listSuppressions(input: { limit: number; offset: number }): Promise<EmailSuppressionRow[]>;
  deleteSuppression(input: { emailHash: string }): Promise<void>;
  deleteSuppressionsBulk(emailHashes: string[]): Promise<number>;
}

export type ConveyorPipelineRowDto = {
  submissionId: string;
  title: string;
  submissionStatus: ItemSubmissionStatus;
  convertedLotId: string | null;
  lotId: string | null;
  lotStatus: LotStatus | null;
  lotTitle: string | null;
  artistReviewRequired: boolean | null;
  archivedSeller: boolean | null;
  assignedToUserId: string | null;
  updatedAt: string;
};

export interface IAdminOpsReadService {
  getAnalyticsDashboard(range: DateRange): Promise<AdminAnalyticsDashboard>;
  getTodayMetrics(): Promise<AdminTodayMetrics>;
  getBidsPerMinute(): Promise<number>;
  listAttentionFeed(): Promise<AttentionItem[]>;
  countPendingSubmissions(filter: Omit<ListSubmissionsFilter, "limit" | "offset">): Promise<number>;
  /** Submissions + converted lots for Arman-style conveyor (limit default 200). */
  listConveyorPipeline(limit?: number): Promise<ConveyorPipelineRowDto[]>;
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
  goLive: SaleroomService["goLive"];
  pause: SaleroomService["pause"];
  resume: SaleroomService["resume"];
  advanceToLot: SaleroomService["advanceToLot"];
  hammerCurrentLot: SaleroomService["hammerCurrentLot"];
  noSaleCurrentLot: SaleroomService["noSaleCurrentLot"];
  closeSession: SaleroomService["closeSession"];
  getSessionStatuses: SaleroomService["getSessionStatuses"];
  getSessionWithRecentEvents: SaleroomService["getSessionWithRecentEvents"];
  publishClerkPaddleBidSummary: SaleroomService["publishClerkPaddleBidSummary"];
  getOperationsSnapshot: AdminSaleOperationsSnapshotService["getSnapshot"];
}

export interface IAdminSaleroomCheckInApplicationService {
  searchCandidates: SaleroomCheckInService["searchCandidates"];
  checkInBidder: SaleroomCheckInService["checkInBidder"];
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

export interface IAdminLiveBiddingApplicationService {
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
    input: Parameters<PaddleService["assignPaddle"]>[0],
  ): Promise<Result<{ paddleNumber: number }, PaddleServiceError | AdminLiveBiddingRateLimitError>>;
  clearPaddle: PaddleService["clearPaddle"];
  listSaleRoster: PaddleService["listSaleRoster"];
}

export interface IAdminSaleroomDisplayService {
  approvePairing: IDisplayPairingService["approvePairing"];
  revokePairing: IDisplayPairingService["revokePairing"];
  listDevices: IDisplayPairingService["listDevices"];
  setOverlay: IDisplayOverlayService["setOverlay"];
  clearOverlay: IDisplayOverlayService["clearOverlay"];
}

export type AdminOperationsRouteServices = {
  requestLifecycle: IAdminRequestLifecycleService;
  ops: IAdminOpsReadService;
  domainEvents: IAdminDomainEventQueryService;
  dashboard: IAdminDashboardQueryService;
  email: IAdminEmailApplicationService;
  display: IAdminSaleroomDisplayService;
  saleroom: IAdminSaleroomApplicationService;
  saleroomCheckIn: IAdminSaleroomCheckInApplicationService;
  liveBidding: IAdminLiveBiddingApplicationService;
};
