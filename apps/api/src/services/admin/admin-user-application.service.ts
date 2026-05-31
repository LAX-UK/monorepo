import { AuthzError } from "../../lib/errors.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { IAdminUserApplicationService } from "../interfaces/admin-routes.js";
import type {
  AdminActivityEntry,
  AdminKycSession,
  AdminUserDetail,
  AdminUserListFilter,
  AdminUserListResult,
} from "../interfaces/admin-user.js";

export class AdminUserApplicationService implements IAdminUserApplicationService {
  constructor(private readonly adminUsers: AdminUserService) {}

  list(filter: AdminUserListFilter): Promise<AdminUserListResult> {
    return this.adminUsers.list(filter);
  }

  getById(id: string): Promise<AdminUserDetail | null> {
    return this.adminUsers.getById(id);
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

  suspend(actorRole: string, userId: string, reason: string | null): Promise<void> {
    return this.adminUsers.suspend(actorRole, userId, reason);
  }

  unsuspend(actorRole: string, userId: string): Promise<void> {
    return this.adminUsers.unsuspend(actorRole, userId);
  }

  activityFor(userId: string, limit: number): Promise<AdminActivityEntry[]> {
    return this.adminUsers.activityFor(userId, limit);
  }

  kycSessionsFor(userId: string, limit?: number): Promise<AdminKycSession[]> {
    return this.adminUsers.kycSessionsFor(userId, limit);
  }

  async bulkSuspendOrUnsuspend(input: {
    actorRole: string;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | null | undefined;
  }): Promise<{ count: number }> {
    const { actorRole, ids, op, reason } = input;
    for (const userId of ids) {
      if (op === "suspend") {
        await this.adminUsers.suspend(actorRole, userId, reason ?? null);
      } else {
        await this.adminUsers.unsuspend(actorRole, userId);
      }
    }
    return { count: ids.length };
  }
}
