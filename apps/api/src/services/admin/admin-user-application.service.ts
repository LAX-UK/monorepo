import { AuthzError } from "../../lib/errors.js";
import type { AdminUserService } from "../admin-user.service.js";
import type { IAdminUserApplicationService } from "../interfaces/admin-routes.js";
import type {
  AdminActivityEntry,
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
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
      await this.adminUsers.setRole(actorRole, actorUserId, targetUserId, role);
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
