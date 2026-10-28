import type {
  AdminKycSession,
  AdminUserListFilter,
  IAdminUserActivityReader,
  IAdminUserBidsReader,
  IAdminUserKycReader,
  IAdminUserReader,
  IAdminUserSuspender,
} from "@auction/persistence/interfaces";
import {
  ADMINISTRATOR_STAFF_ROLE,
  CLIENT_ACTIVITY_ACCESS,
  CLIENT_BIDS_ACCESS,
  CLIENT_KYC_ACCESS,
  type CapabilityRequirement,
  NO_STAFF_ROLES,
  type StaffRoles,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  type UserRole,
  type UserStaffRole,
  hasStaffRole,
  holdsOnlyStaffRole,
  normalizeUserRole,
  normalizeUserStaffRole,
  roleHasCapability,
  userHasAccessTo,
} from "@auction/types";
import { ADMIN_SUSPEND_REASON_MIN } from "@auction/validators";
import { AuthzError } from "../lib/errors.js";
import type {
  IIdentitySecurityClient,
  IdentitySecurityStatus,
} from "./interfaces/identity-issuer-client.js";
import type { IUserSuspensionCacheInvalidator } from "./interfaces/user-suspension.js";
import {
  type IStaffAccessWriter,
  StaffRoleAssignmentRefused,
} from "./staff/staff-role-assignment.service.js";

function assertAdminAccess(
  actorRole: string,
  actorStaffRoles: StaffRoles | undefined,
  requirement: CapabilityRequirement,
): void {
  if (!userHasAccessTo(actorRole as UserRole, actorStaffRoles, requirement)) {
    throw new AuthzError("Forbidden", 403);
  }
}

/** Whether setting `target` on yourself leaves your roles as they are. */
function keepsOwnRoles(own: StaffRoles | undefined, target: UserStaffRole | null): boolean {
  const held = own ?? NO_STAFF_ROLES;
  return target === null ? held.length === 0 : holdsOnlyStaffRole(held, target);
}

/** The signed-in staff member performing a moderation or role action. */
export type AdminActor = {
  userId: string;
  role: string;
  staffRoles: StaffRoles;
};

const lastSuperAdminError = () =>
  new AuthzError("Cannot remove the last active administrator", 409, {
    code: "last_administrator",
  });

const cannotChangeOwnRoleError = () =>
  new AuthzError("You cannot change your own staff role", 403, { code: "cannot_change_own_role" });

export class AdminUserService {
  constructor(
    private readonly reader: IAdminUserReader,
    private readonly staffAccess: IStaffAccessWriter,
    private readonly suspender: IAdminUserSuspender,
    private readonly activity: IAdminUserActivityReader,
    private readonly bids: IAdminUserBidsReader,
    private readonly kyc?: IAdminUserKycReader,
    private readonly suspensionCacheInvalidator?: IUserSuspensionCacheInvalidator,
    private readonly identitySecurity?: IIdentitySecurityClient,
  ) {}

  list(actorRole: string, actorStaffRoles: StaffRoles | undefined, filter: AdminUserListFilter) {
    assertAdminAccess(actorRole, actorStaffRoles, USERS_DIRECTORY_ACCESS);
    return this.reader.list(filter);
  }

  ensureDirectoryAccess(actorRole: string, actorStaffRoles: StaffRoles | undefined): void {
    assertAdminAccess(actorRole, actorStaffRoles, USERS_DIRECTORY_ACCESS);
  }

  async getById(actorRole: string, actorStaffRoles: StaffRoles | undefined, id: string) {
    assertAdminAccess(actorRole, actorStaffRoles, USERS_DIRECTORY_ACCESS);
    const detail = await this.reader.getById(id);
    if (!detail) return null;
    if (!this.identitySecurity) return { ...detail, securityStatusAvailable: false };
    let security: IdentitySecurityStatus | null;
    try {
      security = await this.identitySecurity.readSecurityStatus(id);
    } catch {
      return { ...detail, securityStatusAvailable: false };
    }
    if (!security) return { ...detail, securityStatusAvailable: false };
    return {
      ...detail,
      securityStatusAvailable: true,
      twoFactorEnabled: security.twoFactorEnabled,
      pendingNewEmail: security.pendingNewEmail,
      emailChangeExpiresAt: security.emailChangeExpiresAt,
    };
  }

  getByIds(actorRole: string, actorStaffRoles: StaffRoles | undefined, ids: string[]) {
    assertAdminAccess(actorRole, actorStaffRoles, USERS_DIRECTORY_ACCESS);
    return this.reader.getByIds(ids);
  }

  async setRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    role: string,
    actorStaffRoles: StaffRoles | undefined,
    targetStaffRole: UserStaffRole | null | undefined,
  ) {
    const normalizedRole = normalizeUserRole(role);
    if (!normalizedRole) throw new AuthzError("Invalid role", 400);
    const targetStaff = normalizeUserStaffRole(targetStaffRole ?? undefined);

    if (targetUserId === actorUserId && normalizedRole !== "staff") {
      throw new AuthzError("Cannot demote yourself");
    }
    if (targetUserId === actorUserId && !keepsOwnRoles(actorStaffRoles, targetStaff)) {
      throw cannotChangeOwnRoleError();
    }
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaffRoles)) {
      throw new AuthzError("Forbidden");
    }

    if (normalizedRole === "staff") {
      if (targetStaff == null) {
        throw new AuthzError("staffRole is required when role is staff", 400);
      }
      await this.applyAccess(targetUserId, "staff", [targetStaff], actorUserId);
      return;
    }

    if (targetStaff != null) {
      throw new AuthzError("staffRole must be omitted when role is client", 400);
    }
    await this.applyAccess(targetUserId, "client", [], actorUserId);
  }

  /** Persists a role change through the roster, which refuses removing the last administrator. */
  private async applyAccess(
    targetUserId: string,
    role: UserRole,
    staffRoles: readonly UserStaffRole[],
    actorUserId: string,
  ): Promise<void> {
    try {
      await this.staffAccess.setAccess({
        userId: targetUserId,
        role,
        staffRoles,
        actorUserId,
        reason: null,
      });
    } catch (error) {
      if (error instanceof StaffRoleAssignmentRefused && error.reason === "last_administrator") {
        throw lastSuperAdminError();
      }
      throw error;
    }
  }

  async setStaffRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    staffRole: UserStaffRole | null,
    actorStaffRoles: StaffRoles | undefined,
  ) {
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaffRoles)) {
      throw new AuthzError("Forbidden");
    }
    if (targetUserId === actorUserId) throw cannotChangeOwnRoleError();
    const target = await this.reader.getById(targetUserId);
    if (!target) throw new AuthzError("Not found", 404);
    if (normalizeUserRole(target.role) !== "staff") {
      throw new AuthzError("Staff role applies only to staff accounts", 400);
    }
    if (staffRole == null) {
      throw new AuthzError("staffRole is required for staff accounts", 400);
    }
    await this.applyAccess(targetUserId, "staff", [staffRole], actorUserId);
  }

  async suspend(actor: AdminActor, userId: string, reason: string): Promise<void> {
    await this.suspendMany(actor, [userId], reason, false);
  }

  async unsuspend(actor: AdminActor, userId: string): Promise<void> {
    await this.unsuspendMany(actor, [userId], false);
  }

  /**
   * Suspends every account in one transaction with the actor and reason on each audit event.
   * You cannot suspend yourself, and only a administrator can suspend a staff account.
   */
  async suspendMany(
    actor: AdminActor,
    userIds: string[],
    reason: string,
    bulk: boolean,
  ): Promise<void> {
    assertAdminAccess(actor.role, actor.staffRoles, USER_MODERATION_ACCESS);
    const trimmed = reason.trim();
    if (trimmed.length < ADMIN_SUSPEND_REASON_MIN) {
      throw new AuthzError(
        `A reason of at least ${ADMIN_SUSPEND_REASON_MIN} characters is required`,
        400,
        { code: "reason_required" },
      );
    }
    const ids = [...new Set(userIds)];
    if (ids.includes(actor.userId)) {
      throw new AuthzError("You cannot suspend your own account", 403, {
        code: "cannot_suspend_self",
      });
    }
    await this.assertModeratable(actor, ids);
    await this.suspender.suspendMany({
      userIds: ids,
      reason: trimmed,
      actorUserId: actor.userId,
      bulk,
    });
    await this.invalidateSuspension(ids);
  }

  async unsuspendMany(actor: AdminActor, userIds: string[], bulk: boolean): Promise<void> {
    assertAdminAccess(actor.role, actor.staffRoles, USER_MODERATION_ACCESS);
    const ids = [...new Set(userIds)];
    await this.assertModeratable(actor, ids);
    await this.suspender.unsuspendMany({ userIds: ids, actorUserId: actor.userId, bulk });
    await this.invalidateSuspension(ids);
  }

  /** Every target must exist, and staff accounts are moderated by a administrator only. */
  private async assertModeratable(actor: AdminActor, ids: string[]): Promise<void> {
    const targets = await this.reader.getByIds(ids);
    if (targets.length !== ids.length) throw new AuthzError("User not found", 404);
    const touchesStaff = targets.some((t) => normalizeUserRole(t.role) === "staff");
    if (touchesStaff && !hasStaffRole(actor.staffRoles, ADMINISTRATOR_STAFF_ROLE)) {
      throw new AuthzError("Only a platform admin can suspend or restore a staff account", 403, {
        code: "staff_moderation_requires_administrator",
      });
    }
  }

  private async invalidateSuspension(ids: string[]): Promise<void> {
    if (!this.suspensionCacheInvalidator) return;
    await Promise.all(ids.map((id) => this.suspensionCacheInvalidator?.invalidate(id)));
  }

  activityFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    limit: number,
  ) {
    assertAdminAccess(actorRole, actorStaffRoles, CLIENT_ACTIVITY_ACCESS);
    return this.activity.getRecentSessions(userId, limit);
  }

  kycSessionsFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    limit?: number,
  ): Promise<AdminKycSession[]> {
    assertAdminAccess(actorRole, actorStaffRoles, CLIENT_KYC_ACCESS);
    if (!this.kyc) return Promise.resolve([]);
    return this.kyc.listSessionsForUser(userId, limit);
  }

  bidsFor(
    actorRole: string,
    actorStaffRoles: StaffRoles | undefined,
    userId: string,
    page: { limit: number; offset: number },
  ) {
    assertAdminAccess(actorRole, actorStaffRoles, CLIENT_BIDS_ACCESS);
    return this.bids.listForUser(userId, page);
  }
}
