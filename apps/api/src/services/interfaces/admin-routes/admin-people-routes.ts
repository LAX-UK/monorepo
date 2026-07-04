import type { AdminActivityEntry, AdminUserDetail, AdminUserListFilter, AdminUserListResult, AdminUserListRow } from "@auction/persistence/interfaces";
import type { InvitationAdminListFilters, InvitationAdminListRow } from "@auction/persistence/interfaces";
import type { UserRole, UserStaffRole } from "@auction/types";
import type { Result } from "neverthrow";
import type { CreateInvitationInput, InvitationError } from "../../invitation.service.js";

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
  ): Promise<import("@auction/persistence/interfaces").AdminKycSession[]>;
  bidsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<import("@auction/persistence/interfaces").AdminUserBidListResult>;
  bulkSuspendOrUnsuspend(input: {
    actorRole: string;
    actorStaffRole: string | null | undefined;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | null | undefined;
  }): Promise<{ count: number }>;
  updateProfileName(userId: string, name: string): Promise<void>;
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

export type AdminPeopleRouteServices = {
  impersonation: IAdminImpersonationService;
  users: IAdminUserApplicationService;
  invitations: IAdminInvitationApplicationService;
};
