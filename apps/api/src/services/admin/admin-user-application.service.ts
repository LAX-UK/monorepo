import { AuthzError } from "../../lib/errors.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { IAdminUserApplicationService } from "../interfaces/admin-routes.js";
import type {
  AdminActivityEntry,
  AdminKycSession,
  AdminUserBidListResult,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
  AdminUserListRow,
} from "../interfaces/admin-user.js";

export class AdminUserApplicationService implements IAdminUserApplicationService {
  constructor(private readonly adminUsers: AdminUserService) {}

  list(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    filter: AdminUserListFilter,
  ): Promise<AdminUserListResult> {
    return this.adminUsers.list(actorRole, actorStaffRole, filter);
  }

  getById(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    id: string,
  ): Promise<AdminUserDetail | null> {
    return this.adminUsers.getById(actorRole, actorStaffRole, id);
  }

  getByIds(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    ids: string[],
  ): Promise<AdminUserListRow[]> {
    return this.adminUsers.getByIds(actorRole, actorStaffRole, ids);
  }

  async setRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
    actorStaffRole?: string | null,
    targetStaffRole?: import("@auction/types").UserStaffRole | null,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
      await this.adminUsers.setRole(
        actorRole,
        actorUserId,
        targetUserId,
        role,
        actorStaffRole,
        targetStaffRole ?? null,
      );
      return { ok: true };
    } catch (e) {
      if (e instanceof AuthzError) {
        return { ok: false, status: e.status, message: e.message };
      }
      const msg = e instanceof Error ? e.message : "Failed";
      return { ok: false, status: 400, message: msg };
    }
  }

  async setStaffRole(
    actorRole: string,
    _actorUserId: string,
    targetUserId: string,
    staffRole: import("@auction/types").UserStaffRole | null,
    actorStaffRole?: string | null,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
      await this.adminUsers.setStaffRole(actorRole, targetUserId, staffRole, actorStaffRole);
      return { ok: true };
    } catch (e) {
      if (e instanceof AuthzError) {
        return { ok: false, status: e.status, message: e.message };
      }
      const msg = e instanceof Error ? e.message : "Failed";
      return { ok: false, status: 400, message: msg };
    }
  }

  suspend(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    reason: string | null,
  ): Promise<void> {
    return this.adminUsers.suspend(actorRole, actorStaffRole, userId, reason);
  }

  unsuspend(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
  ): Promise<void> {
    return this.adminUsers.unsuspend(actorRole, actorStaffRole, userId);
  }

  activityFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit: number,
  ): Promise<AdminActivityEntry[]> {
    return this.adminUsers.activityFor(actorRole, actorStaffRole, userId, limit);
  }

  kycSessionsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    limit?: number,
  ): Promise<AdminKycSession[]> {
    return this.adminUsers.kycSessionsFor(actorRole, actorStaffRole, userId, limit);
  }

  bidsFor(
    actorRole: string,
    actorStaffRole: string | null | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<AdminUserBidListResult> {
    return this.adminUsers.bidsFor(actorRole, actorStaffRole, userId, page);
  }

  async bulkSuspendOrUnsuspend(input: {
    actorRole: string;
    actorStaffRole: string | null | undefined;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | null | undefined;
  }): Promise<{ count: number }> {
    const { actorRole, actorStaffRole, ids, op, reason } = input;
    for (const userId of ids) {
      if (op === "suspend") {
        await this.adminUsers.suspend(actorRole, actorStaffRole, userId, reason ?? null);
      } else {
        await this.adminUsers.unsuspend(actorRole, actorStaffRole, userId);
      }
    }
    return { count: ids.length };
  }
}
