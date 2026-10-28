import type {
  AdminActivityEntry,
  AdminKycSession,
  AdminUserBidListResult,
  AdminUserListFilter,
  AdminUserListRow,
  IAdminUserBrowseReader,
} from "@auction/persistence/interfaces";
import type { StaffRoles } from "@auction/types";
import { AuthzError } from "../../lib/errors.js";
import type { AdminActor, AdminUserService } from "../admin-user.service.js";
import type {
  AdminUserDetailResponse,
  IAdminUserApplicationService,
} from "../interfaces/admin-routes.js";
import type { ProfileService } from "../profile.service.js";
import type { AdminUserListPage } from "./admin-user-list-query.service.js";
import { AdminUserListQueryService } from "./admin-user-list-query.service.js";

export class AdminUserApplicationService implements IAdminUserApplicationService {
  private readonly listQuery: AdminUserListQueryService;

  constructor(
    private readonly adminUsers: AdminUserService,
    private readonly profiles: ProfileService,
    adminUserReader: IAdminUserBrowseReader,
  ) {
    this.listQuery = new AdminUserListQueryService(adminUserReader);
  }

  getPage(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    filter: AdminUserListFilter,
  ): Promise<AdminUserListPage> {
    this.adminUsers.ensureDirectoryAccess(actorRole, actorStaffRoles);
    return this.listQuery.getPage(filter);
  }

  getById(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    id: string,
  ): Promise<AdminUserDetailResponse | null> {
    return this.adminUsers.getById(actorRole, actorStaffRoles, id);
  }

  getByIds(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    ids: string[],
  ): Promise<AdminUserListRow[]> {
    return this.adminUsers.getByIds(actorRole, actorStaffRoles, ids);
  }

  async setRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
    actorStaffRoles?: StaffRoles | undefined,
    targetStaffRole?: import("@auction/types").UserStaffRole | null,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
      await this.adminUsers.setRole(
        actorRole,
        actorUserId,
        targetUserId,
        role,
        actorStaffRoles,
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
    actorUserId: string,
    targetUserId: string,
    staffRole: import("@auction/types").UserStaffRole | null,
    actorStaffRoles?: StaffRoles | undefined,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    try {
      await this.adminUsers.setStaffRole(
        actorRole,
        actorUserId,
        targetUserId,
        staffRole,
        actorStaffRoles,
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

  suspend(actor: AdminActor, userId: string, reason: string): Promise<void> {
    return this.adminUsers.suspend(actor, userId, reason);
  }

  unsuspend(actor: AdminActor, userId: string): Promise<void> {
    return this.adminUsers.unsuspend(actor, userId);
  }

  activityFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    limit: number,
  ): Promise<AdminActivityEntry[]> {
    return this.adminUsers.activityFor(actorRole, actorStaffRoles, userId, limit);
  }

  kycSessionsFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    limit?: number,
  ): Promise<AdminKycSession[]> {
    return this.adminUsers.kycSessionsFor(actorRole, actorStaffRoles, userId, limit);
  }

  bidsFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<AdminUserBidListResult> {
    return this.adminUsers.bidsFor(actorRole, actorStaffRoles, userId, page);
  }

  async bulkSuspendOrUnsuspend(input: {
    actor: AdminActor;
    ids: string[];
    op: "suspend" | "unsuspend";
    reason: string | undefined;
  }): Promise<{ count: number }> {
    const { actor, ids, op, reason } = input;
    if (op === "suspend") {
      await this.adminUsers.suspendMany(actor, ids, reason ?? "", true);
    } else {
      await this.adminUsers.unsuspendMany(actor, ids, true);
    }
    return { count: new Set(ids).size };
  }

  updateProfileName(userId: string, name: string) {
    return this.profiles.updateProfile(userId, { name });
  }
}
