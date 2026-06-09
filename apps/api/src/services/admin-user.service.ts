import {
  CLIENT_ACTIVITY_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  type CapabilityRequirement,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  type UserRole,
  type UserStaffRole,
  normalizeUserRole,
  normalizeUserStaffRole,
  roleHasCapability,
  userHasAccessTo,
} from "@auction/types";
import { AuthzError } from "../lib/errors.js";
import type {
  AdminKycSession,
  AdminUserListFilter,
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserKycReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IAdminUserSuspender,
} from "./interfaces/admin-user.js";

function assertAdminAccess(
  actorRole: string,
  actorStaffRole: string | null | undefined,
  requirement: CapabilityRequirement,
): void {
  const role = actorRole as UserRole;
  const staff = normalizeUserStaffRole(actorStaffRole);
  if (!userHasAccessTo(role, staff, requirement)) {
    throw new AuthzError("Forbidden", 403);
  }
}

export class AdminUserService {
  constructor(
    private readonly reader: IAdminUserReader,
    private readonly roles: IAdminUserRoleManager,
    private readonly suspender: IAdminUserSuspender,
    private readonly activity: IAdminUserActivityReader,
    private readonly bids: IAdminUserBidsReader,
    private readonly kyc?: IAdminUserKycReader,
  ) {}

  list(actorRole: string, actorStaffRole: string | null | undefined, filter: AdminUserListFilter) {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
    return this.reader.list(filter);
  }

  getById(actorRole: string, actorStaffRole: string | null | undefined, id: string) {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
    return this.reader.getById(id);
  }

  getByIds(actorRole: string, actorStaffRole: string | null | undefined, ids: string[]) {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
    return this.reader.getByIds(ids);
  }

  async setRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
    actorStaffRole: string | null | undefined,
    targetStaffRole: UserStaffRole | null | undefined,
  ) {
    const normalizedRole = normalizeUserRole(role);
    if (!normalizedRole) throw new AuthzError("Invalid role", 400);
    const targetStaff = normalizeUserStaffRole(targetStaffRole ?? undefined);

    if (targetUserId === actorUserId && normalizedRole !== "staff") {
      throw new AuthzError("Cannot demote yourself");
    }
    const actorStaff = normalizeUserStaffRole(actorStaffRole);
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaff)) {
      throw new AuthzError("Forbidden");
    }

    if (normalizedRole === "staff") {
      if (targetStaff == null) {
        throw new AuthzError("staffRole is required when role is staff", 400);
      }
      await this.roles.setRoleAndStaff(targetUserId, "staff", targetStaff);
      return;
    }

    if (targetStaff != null) {
      throw new AuthzError("staffRole must be omitted when role is client", 400);
    }
    await this.roles.setRoleAndStaff(targetUserId, "client", null);
  }

  async setStaffRole(
    actorRole: string,
    targetUserId: string,
    staffRole: UserStaffRole | null,
    actorStaffRole?: string | null,
  ) {
    const actorStaff = normalizeUserStaffRole(actorStaffRole);
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaff)) {
      throw new AuthzError("Forbidden");
    }
    const target = await this.reader.getById(targetUserId);
    if (!target) throw new AuthzError("Not found", 404);
    if (normalizeUserRole(target.role) !== "staff") {
      throw new AuthzError("Staff role applies only to staff accounts", 400);
    }
    if (staffRole == null) {
      throw new AuthzError("staffRole is required for staff accounts", 400);
    }
    await this.roles.setRoleAndStaff(targetUserId, "staff", staffRole);
  }

  suspend(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    reason: string | null,
  ) {
    assertAdminAccess(actorRole, actorStaffRole, USER_MODERATION_ACCESS);
    return this.suspender.suspend(userId, reason);
  }

  unsuspend(actorRole: string, actorStaffRole: string | null | undefined, userId: string) {
    assertAdminAccess(actorRole, actorStaffRole, USER_MODERATION_ACCESS);
    return this.suspender.unsuspend(userId);
  }

  activityFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit: number,
  ) {
    assertAdminAccess(actorRole, actorStaffRole, CLIENT_ACTIVITY_ACCESS);
    return this.activity.getRecentSessions(userId, limit);
  }

  kycSessionsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit?: number,
  ): Promise<AdminKycSession[]> {
    assertAdminAccess(actorRole, actorStaffRole, CLIENT_KYC_ACCESS);
    if (!this.kyc) return Promise.resolve([]);
    return this.kyc.listSessionsForUser(userId, limit);
  }

  bidsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ) {
    assertAdminAccess(actorRole, actorStaffRole, CLIENT_BIDS_ACCESS);
    return this.bids.listForUser(userId, page);
  }
}
