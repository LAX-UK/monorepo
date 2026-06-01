import type { EmailOutboxStatus } from "@auction/db/schema";
import type {
  AdminArtistListResult,
  AdminArtistStats,
  AdminCategory,
  ArtistProfile,
  Category,
  ItemSubmissionStatus,
  LegalEntity,
  LegalEntityStatus,
  Lot,
  LotStatus,
  UserRole,
  UserStaffRole,
} from "@auction/types";
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
import type { CreateInvitationInput, InvitationError } from "../invitation.service.js";
import type { LegalEntityLifecycleFailure } from "../legal-entity-lifecycle-admin.service.js";
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
import type { EmailEventRow, EmailOutboxRow, EmailSuppressionRow } from "./email-observability.js";
import type { InvitationAdminListRow } from "./invitation.js";
import type { ListSubmissionsFilter } from "./repositories.js";

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
  listPendingAdminReviewTasks(
    kind: "lot_artist_backfill" | "lot_withdrawal_request",
  ): Promise<AdminReviewTaskRow[]>;
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
  bulkSuspendOrUnsuspend(input: {
    actorRole: string;
    actorStaffRole: string | null | undefined;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | null | undefined;
  }): Promise<{ count: number }>;
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
}

export interface IAdminInvitationApplicationService {
  create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>>;
  listInvitationsForActor(actorUserId: string): Promise<InvitationAdminListRow[]>;
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
}

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

export type AdminRouteServices = {
  requestLifecycle: IAdminRequestLifecycleService;
  ops: IAdminOpsReadService;
  impersonation: IAdminImpersonationService;
  domainEvents: IAdminDomainEventQueryService;
  dashboard: IAdminDashboardQueryService;
  catalog: IAdminCatalogApplicationService;
  email: IAdminEmailApplicationService;
  users: IAdminUserApplicationService;
  payments: IAdminPaymentsApplicationService;
  lots: IAdminLotsApplicationService;
  invitations: IAdminInvitationApplicationService;
  legalEntityLifecycle: IAdminLegalEntityLifecycleApplicationService;
  xero: IXeroAdminApplicationService;
};
