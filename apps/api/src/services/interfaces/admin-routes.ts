import type { EmailOutboxStatus } from "@auction/db/schema";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  AdminCategory,
  AdminDisputeCaseRow,
  AdminDisputeCaseSummary,
  ArtistProfile,
  Category,
  DisputeCaseListFilter,
  ItemSubmissionStatus,
  LegalEntity,
  LegalEntityStatus,
  Lot,
  LotStatus,
  UserRole,
  UserStaffRole,
} from "@auction/types";
import type { ResolvedQrCodeAnalyticsQuery } from "@auction/validators";
import type { Result } from "neverthrow";
import type {
  AdminArtistListOptions,
  AdminCatalogCreateArtistBody,
  AdminCatalogUpdateArtistBody,
  AdminManualReviewPaymentRow,
  AdminOnboardingIssues,
  AdminReviewTaskRow,
} from "../../admin/admin-route-dtos.js";
import type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
} from "../../lib/admin-legal-entity-browse.js";
import type { AuthzError } from "../../lib/errors.js";
import type { LifecycleAdminOp } from "../../lib/legal-entity-lifecycle-transitions.js";
import type { AdminTodayMetrics } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type { AdminNavCounts } from "../admin/admin-nav-counts.service.js";
import type { AdminSourceOfFundsQueryService } from "../admin/admin-source-of-funds-query.service.js";
import type {
  AdminLegalEntityDocumentDto,
  LegalEntityDocumentAdminService,
} from "../admin/legal-entity-document-admin.service.js";
import type { AmlService } from "../aml/aml.service.js";
import type { PlaceBidWithIdempotencyOutcome } from "../bid/place-bid-idempotency.js";
import type { CreateInvitationInput, InvitationError } from "../invitation.service.js";
import type { LegalEntityLifecycleFailure } from "../legal-entity-lifecycle-admin.service.js";
import type { LotFulfilmentService } from "../lot-fulfilment.service.js";
import type {
  LotLifecycleSnapshotRow,
  LotLifecycleTimelineEvent,
} from "../lot-lifecycle-query.service.js";
import type { LotTransitionOrchestrator } from "../lot-transition-orchestrator.js";
import type { PaddleService, PaddleServiceError } from "../paddle.service.js";
import type { QrCodeAnalyticsService } from "../qr-code-analytics.service.js";
import type { QrCodeService } from "../qr-code.service.js";
import type { SaleRegistrationService } from "../sale-registration.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import type { SaleroomService } from "../saleroom.service.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";
import type { SourceOfFundsDocumentReviewService } from "../source-of-funds/source-of-funds-document-review.service.js";
import type { SourceOfFundsService } from "../source-of-funds/source-of-funds.service.js";
import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "./admin-kpi-trend.js";
import type {
  AdminActivityEntry,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  AdminUserListRow,
} from "./admin-user.js";
import type { AdminAnalyticsDashboard, DateRange } from "./analytics.js";
import type { ArtistSearchHit } from "./artist-registry.js";
import type { AttentionItem } from "./attention-feed.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.js";
import type {
  ConditionReportServiceError,
  FulfillConditionReportInput,
  IConditionReportService,
} from "./condition-report.js";
import type { IDisplayOverlayService } from "./display-overlay-service.js";
import type { IDisplayPairingService } from "./display-pairing-service.js";
import type { EmailEventRow, EmailOutboxRow, EmailSuppressionRow } from "./email-observability.js";
import type { InvitationAdminListFilters, InvitationAdminListRow } from "./invitation.js";
import type { ListPaymentsAdminTableFilter } from "./payment-write.js";
import type { ListSubmissionsFilter } from "./repositories.js";
import type { IStripeConnectService } from "./stripe-connect.js";

export type AdminImpersonationLookupResult =
  | { ok: true; data: { id: string; displayName: string; status: string } }
  | { ok: false; notFound: true };

export type AdminImpersonationStartResult =
  | {
      ok: true;
      data: {
        actingCookie: string;
        sessionId: string;
        expiresAt: string;
        displayName: string;
      };
    }
  | { ok: false; status: 400; error: "not_impersonation"; message: string }
  | { ok: false; status: 404; error: "not_found" };

export type AdminImpersonationRecordFailedEndResult =
  | { ok: true; alreadyEnded?: boolean }
  | { ok: false; status: 404 | 400; error: string };

export interface IAdminImpersonationService {
  lookupForImpersonation(legalEntityId: string): Promise<AdminImpersonationLookupResult>;
  startImpersonation(input: {
    actorUserId: string;
    legalEntityId: string;
    cookieHeader: string | undefined;
  }): Promise<AdminImpersonationStartResult>;
  endImpersonation(input: { actorUserId: string; cookieHeader: string | undefined }): Promise<
    { ok: true } | { ok: false; error: "no_active_impersonation" }
  >;
  recordFailedEnd(input: {
    actorUserId: string;
    sessionId: string;
    legalEntityId: string;
  }): Promise<AdminImpersonationRecordFailedEndResult>;
}

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

export type { AdminDisputeCaseRow, AdminDisputeCaseSummary, DisputeCaseListFilter };

export interface IAdminDisputeCaseQueryService {
  listCases(input: {
    limit: number;
    offset: number;
    status?: DisputeCaseListFilter;
  }): Promise<{
    rows: AdminDisputeCaseRow[];
    hasNextPage: boolean;
    summary: AdminDisputeCaseSummary;
  }>;
  countOpenCases(): Promise<number>;
}

export type FinanceIssueSnapshot = {
  failedPayoutCount: number;
  legalEntitiesWithStripeConnectRequirementsCount: number;
  staleBlockedScheduledPayoutCount: number;
  entitiesPendingReviewCount: number;
  artistsPendingApprovalCount: number;
  staleKycSessionsCount: number;
  documentsAwaitingReviewCount: number;
  staleLeadOrganisationsCount: number;
};

export type {
  AdminLegalEntityBrowseParams,
  AdminLegalEntityBrowseResult,
  AdminLegalEntityBrowseRow,
} from "../../lib/admin-legal-entity-browse.js";

export interface IAdminDashboardQueryService {
  searchLegalEntitiesBrowse(
    params: AdminLegalEntityBrowseParams,
  ): Promise<AdminLegalEntityBrowseResult>;
  getFinanceIssueSnapshot(): Promise<FinanceIssueSnapshot>;
  getOnboardingIssues(): Promise<AdminOnboardingIssues>;
  listStripeConnectRequirementEntities(): Promise<
    {
      id: string;
      displayName: string;
      status: string;
      stripeConnectRequirementsCurrentlyDue: string[];
    }[]
  >;
  listManualReviewPayments(): Promise<AdminManualReviewPaymentRow[]>;
  countManualReviewPayments(): Promise<number>;
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
  countPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<number>;
}

export interface IAdminCatalogApplicationService {
  listCategoriesForAdmin(input: { includeArchived: boolean }): Promise<AdminCategory[]>;
  createCategory(body: CreateCategoryInput, actorUserId?: string | null): Promise<Category>;
  getCategory(categoryId: string): Promise<AdminCategory | null>;
  updateCategory(
    categoryId: string,
    body: UpdateCategoryInput,
    actorUserId?: string | null,
  ): Promise<Category>;
  archiveCategory(categoryId: string, actorUserId?: string | null): Promise<Category>;
  deleteCategory(categoryId: string, actorUserId?: string | null): Promise<void>;
  listArtists(input: AdminArtistListOptions): Promise<AdminArtistListResult>;
  getArtistStats(): Promise<AdminArtistStats>;
  listArtistDuplicateCandidates(artistId: string): Promise<ArtistSearchHit[]>;
  createArtist(adminUserId: string, body: AdminCatalogCreateArtistBody): Promise<ArtistProfile>;
  getArtist(artistId: string): Promise<ArtistProfile | null>;
  updateArtist(artistId: string, body: AdminCatalogUpdateArtistBody): Promise<ArtistProfile>;
  searchArtists(query: string, limit?: number): Promise<ArtistSearchHit[]>;
  resolvePlatformCatalogLegalEntityId(): Promise<string | null>;
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

export interface IAdminUserApplicationService {
  list(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    filter: AdminUserListFilter,
  ): Promise<AdminUserListResult>;
  getById(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    id: string,
  ): Promise<AdminUserDetail | null>;
  getByIds(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    ids: string[],
  ): Promise<AdminUserListRow[]>;
  setRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
    actorStaffRole?: string | null,
    targetStaffRole?: import("@auction/types").UserStaffRole | null,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }>;
  setStaffRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    staffRole: import("@auction/types").UserStaffRole | null,
    actorStaffRole?: string | null,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }>;
  suspend(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    reason: string | null,
  ): Promise<void>;
  unsuspend(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
  ): Promise<void>;
  activityFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit: number,
  ): Promise<AdminActivityEntry[]>;
  kycSessionsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit?: number,
  ): Promise<import("./admin-user.js").AdminKycSession[]>;
  bidsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<import("./admin-user.js").AdminUserBidListResult>;
  bulkSuspendOrUnsuspend(input: {
    actorRole: string;
    actorStaffRole: string | null | undefined;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | null | undefined;
  }): Promise<{ count: number }>;
  updateProfileName(userId: string, name: string): Promise<void>;
}

export interface IAdminPaymentsApplicationService {
  releaseManualReviewForCapture(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>>;
  refundManualReviewPayment(
    adminUserId: string,
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<void, AuthzError>>;
  syncPaymentFromXeroAsAdmin(
    userRole: string,
    paymentId: string,
    userStaffRole?: string | null,
  ): Promise<Result<{ ok: boolean; error?: string }, AuthzError>>;
  listPage(
    filter: ListPaymentsAdminTableFilter,
  ): Promise<import("../admin/admin-payment-list-query.service.js").AdminPaymentListPage>;
}

export interface IAdminLotsApplicationService {
  approveWithdrawalRequest(
    adminUserId: string,
    adminRole: UserRole,
    lotId: string,
    adminStaffRole?: UserStaffRole | null,
  ): Promise<
    | { ok: true; data: Lot }
    | { ok: false; status: number; error: string; code?: string | undefined }
  >;
  listAttachable(
    input: import("../admin/admin-lot-browse.service.js").AdminLotBrowseInput,
  ): Promise<{
    data: import("../admin/admin-lot-browse.service.js").AdminAttachableLotRow[];
    total: number;
  }>;
  returnToInventory: LotTransitionOrchestrator["returnToInventory"];
  getLifecycle(
    lotId: string,
    opts?: { limit?: number; includeSaleContext?: boolean },
  ): Promise<{
    snapshot: LotLifecycleSnapshotRow | null;
    events: LotLifecycleTimelineEvent[];
  }>;
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

export interface IAdminLotFulfilmentApplicationService {
  listForAdmin: LotFulfilmentService["listForAdmin"];
  getByLotIdForAdmin: LotFulfilmentService["getByLotIdForAdmin"];
  approveRelease: LotFulfilmentService["approveRelease"];
  markShipped: LotFulfilmentService["markShipped"];
  markReadyForCollection: LotFulfilmentService["markReadyForCollection"];
  markDelivered: LotFulfilmentService["markDelivered"];
  markCollected: LotFulfilmentService["markCollected"];
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

export interface IAdminInvitationApplicationService {
  create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>>;
  listInvitations(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<{
    rows: InvitationAdminListRow[];
    total: number;
    pendingTotal: number;
    acceptedTotal: number;
  }>;
  revoke(input: { actorUserId: string; invitationId: string }): Promise<
    Result<void, InvitationError>
  >;
  resend(input: {
    actorUserId: string;
    invitationId: string;
  }): Promise<Result<{ expiresAt: Date }, InvitationError>>;
  preview(token: string): Promise<
    Result<
      {
        email: string;
        targetRole: UserRole;
        targetStaffRole: UserStaffRole | null;
        expiresAt: Date;
        entityScoped: boolean;
      },
      InvitationError
    >
  >;
}

export interface IAdminLegalEntityLifecycleApplicationService {
  findLegalEntityById(id: string): Promise<LegalEntity | null>;
  runTransition(
    userId: string,
    entityId: string,
    op: LifecycleAdminOp,
    reason?: string | null,
  ): Promise<Result<{ id: string; status: LegalEntityStatus }, LegalEntityLifecycleFailure>>;
  listDocuments(entityId: string): Promise<AdminLegalEntityDocumentDto[] | null>;
  reviewDocument: LegalEntityDocumentAdminService["reviewDocument"];
}

export interface IAdminSaleRegistrationsApplicationService {
  listForSaleAdmin: SaleRegistrationService["listForSaleAdmin"];
  approve: SaleRegistrationService["approve"];
  reject: SaleRegistrationService["reject"];
  updateBidLimit: SaleRegistrationService["updateBidLimit"];
}

export type IAdminStripeConnectApplicationService = IStripeConnectService & {
  readonly webOrigin: string | undefined;
};

export type XeroConnectionHealth = "healthy" | "degraded" | "disconnected";

export type XeroStatusPayload = {
  connected: boolean;
  tenantId: string | null;
  tenantName: string | null;
  expiresAt: string | null;
  oauthConfigured: boolean;
  connectedAt: string | null;
  updatedAt: string | null;
  connectedBy: { id: string; name: string; email: string } | null;
  scopes: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
  recentWebhookErrors: number;
  syncErrorCount: number;
  health: XeroConnectionHealth;
  connectionStatus: "healthy" | "needs_reauth" | null;
  lastRefreshError: string | null;
  orgShortCode: string | null;
  orgBaseCurrency: string | null;
};

export interface IXeroAdminApplicationService {
  getStatusPayload(): Promise<XeroStatusPayload>;
  buildConsentUrl(
    userId: string,
  ): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
  completeOAuth(input: {
    userId: string;
    state: string;
    callbackFullUrl: string;
  }): Promise<{ ok: true } | { ok: false; message: string }>;
  disconnect(): Promise<{ ok: true } | { ok: false; error: string }>;
}

export type { AdminNavCounts } from "../admin/admin-nav-counts.service.js";
export type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "./admin-kpi-trend.js";

export interface IAdminDashboardMetricsService {
  getNavCounts(): Promise<AdminNavCounts>;
  getLotsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getPaymentsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getSalesTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
  getPayoutsTrend(periodDays: AdminKpiPeriodDays): Promise<AdminKpiTrendBundle>;
}

export interface IAdminSaleroomDisplayService {
  approvePairing: IDisplayPairingService["approvePairing"];
  revokePairing: IDisplayPairingService["revokePairing"];
  listDevices: IDisplayPairingService["listDevices"];
  setOverlay: IDisplayOverlayService["setOverlay"];
  clearOverlay: IDisplayOverlayService["clearOverlay"];
}

export interface IAdminQrCodesApplicationService {
  listForEntity: QrCodeService["listForEntity"];
  getOrCreateDefault: QrCodeService["getOrCreateDefault"];
  update: QrCodeService["update"];
  regenerateDefault: QrCodeService["regenerateDefault"];
  getDetailedAnalytics(
    id: string,
    query: ResolvedQrCodeAnalyticsQuery,
  ): ReturnType<QrCodeAnalyticsService["getDetailed"]>;
}

export interface IAdminConditionReportsApplicationService {
  listForAdmin: IConditionReportService["listForAdmin"];
  markInProgress: IConditionReportService["markInProgress"];
  fulfill(input: FulfillConditionReportInput): Promise<Result<Lot, ConditionReportServiceError>>;
  decline: IConditionReportService["decline"];
}

export interface IAdminAmlApplicationService {
  listForUser: AmlService["listForUser"];
  listPendingReviews: AmlService["listPendingReviews"];
  countPendingReviews: AmlService["countPendingReviews"];
  triage: AmlService["triage"];
  decide: AmlService["decide"];
}

export interface IAdminSourceOfFundsApplicationService {
  readonly staffPreviewEnv: {
    WEB_ORIGIN: string;
    WEB_ORIGINS?: string[] | undefined;
    SSR_TRUSTED_ORIGINS?: string[] | undefined;
  };
  listEnriched: AdminSourceOfFundsQueryService["listEnriched"];
  getDetail: AdminSourceOfFundsQueryService["getDetail"];
  listForUser: AdminSourceOfFundsQueryService["listForUser"];
  triage: SourceOfFundsService["triage"];
  decide: SourceOfFundsService["decide"];
  reopenRejected: SourceOfFundsService["reopenRejected"];
  requestDocuments: SourceOfFundsDocumentCollectionService["requestDocuments"];
  getStaffDownloadUrl: SourceOfFundsDocumentCollectionService["getStaffDownloadUrl"];
  getStaffBulkDownloadZip: SourceOfFundsDocumentCollectionService["getStaffBulkDownloadZip"];
  getStaffPreviewBytes: SourceOfFundsDocumentCollectionService["getStaffPreviewBytes"];
  reviewDocument: SourceOfFundsDocumentReviewService["reviewDocument"];
}

export type AdminRouteServices = {
  requestLifecycle: IAdminRequestLifecycleService;
  ops: IAdminOpsReadService;
  impersonation: IAdminImpersonationService;
  domainEvents: IAdminDomainEventQueryService;
  disputeCases: IAdminDisputeCaseQueryService;
  dashboard: IAdminDashboardQueryService;
  catalog: IAdminCatalogApplicationService;
  email: IAdminEmailApplicationService;
  users: IAdminUserApplicationService;
  payments: IAdminPaymentsApplicationService;
  lots: IAdminLotsApplicationService;
  invitations: IAdminInvitationApplicationService;
  legalEntityLifecycle: IAdminLegalEntityLifecycleApplicationService;
  xero: IXeroAdminApplicationService;
  display: IAdminSaleroomDisplayService;
  dashboardMetrics: IAdminDashboardMetricsService;
  qrCodes: IAdminQrCodesApplicationService;
  conditionReports: IAdminConditionReportsApplicationService;
  aml: IAdminAmlApplicationService;
  sourceOfFunds: IAdminSourceOfFundsApplicationService;
  saleRegistrations: IAdminSaleRegistrationsApplicationService;
  stripeConnect: IAdminStripeConnectApplicationService;
  saleroom: IAdminSaleroomApplicationService;
  saleroomCheckIn: IAdminSaleroomCheckInApplicationService;
  lotFulfilment: IAdminLotFulfilmentApplicationService;
  liveBidding: IAdminLiveBiddingApplicationService;
};
