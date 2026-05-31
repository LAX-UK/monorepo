import {
  type UserRole,
  type UserStaffRole,
  normalizeUserRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { AuthzError } from "../lib/errors.js";
import type {
  AdminKycSession,
  AdminUserListFilter,
  IAdminUserActivityReader,
  IAdminUserKycReader,
  IAdminUserReader,
  IAdminUserRoleManager,
  IAdminUserSuspender,
} from "./interfaces/admin-user.js";

export class AdminUserService {
  constructor(
    private readonly reader: IAdminUserReader,
    private readonly roles: IAdminUserRoleManager,
    private readonly suspender: IAdminUserSuspender,
    private readonly activity: IAdminUserActivityReader,
    private readonly kyc?: IAdminUserKycReader,
  ) {}

  list(filter: AdminUserListFilter) {
    return this.reader.list(filter);
  }

  getById(id: string) {
    return this.reader.getById(id);
  }

  getByIds(ids: string[]) {
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

  suspend(_actorRole: string, userId: string, reason: string | null) {
    return this.suspender.suspend(userId, reason);
  }

  unsuspend(_actorRole: string, userId: string) {
    return this.suspender.unsuspend(userId);
  }

  activityFor(userId: string, limit: number) {
    return this.activity.getRecentSessions(userId, limit);
  }

  kycSessionsFor(userId: string, limit?: number): Promise<AdminKycSession[]> {
    if (!this.kyc) return Promise.resolve([]);
    return this.kyc.listSessionsForUser(userId, limit);
  }
}
