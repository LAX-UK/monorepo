import { roleHasCapability, type UserRole } from "@auction/types";
import { AuthzError } from "../lib/errors.js";
import type {
  AdminUserListFilter,
  IAdminUserActivityReader,
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
  ) {}

  list(filter: AdminUserListFilter) {
    return this.reader.list(filter);
  }

  getById(id: string) {
    return this.reader.getById(id);
  }

  async setRole(actorRole: string, actorUserId: string, targetUserId: string, role: string) {
    if (targetUserId === actorUserId && role !== "administrator") {
      throw new AuthzError("Cannot demote yourself");
    }
    if (!roleHasCapability(actorRole as UserRole, "user.invite")) {
      throw new AuthzError("Forbidden");
    }
    await this.roles.setRole(actorRole, targetUserId, role);
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
}
