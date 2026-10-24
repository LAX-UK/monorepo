import {
  type AdminKycSession,
  type AdminUserListFilter,
  type IAdminUserActivityReader,
  type IAdminUserBidsReader,
  type IAdminUserKycReader,
  type IAdminUserReader,
  type IAdminUserRoleManager,
  type IAdminUserSuspender,
  LastSuperAdminError,
} from "@auction/persistence/interfaces";
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
import { ADMIN_SUSPEND_REASON_MIN } from "@auction/validators";
import { AuthzError } from "../lib/errors.js";
import type {
  IIdentitySecurityClient,
  IdentitySecurityStatus,
} from "./interfaces/identity-issuer-client.js";
import type { IUserSuspensionCacheInvalidator } from "./interfaces/user-suspension.js";

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

/** The signed-in staff member performing a moderation or role action. */
export type AdminActor = {
  userId: string;
  role: string;
  staffRole: string | null | undefined;
};

const lastSuperAdminError = () =>
  new AuthzError("Cannot remove the last active super admin", 409, { code: "last_super_admin" });

const cannotChangeOwnRoleError = () =>
  new AuthzError("You cannot change your own staff role", 403, { code: "cannot_change_own_role" });

export class AdminUserService {
  constructor(
    private readonly reader: IAdminUserReader,
    private readonly roles: IAdminUserRoleManager,
    private readonly suspender: IAdminUserSuspender,
    private readonly activity: IAdminUserActivityReader,
    private readonly bids: IAdminUserBidsReader,
    private readonly kyc?: IAdminUserKycReader,
    private readonly suspensionCacheInvalidator?: IUserSuspensionCacheInvalidator,
    private readonly identitySecurity?: IIdentitySecurityClient,
  ) {}

  list(actorRole: string, actorStaffRole: string | null | undefined, filter: AdminUserListFilter) {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
    return this.reader.list(filter);
  }

  ensureDirectoryAccess(actorRole: string, actorStaffRole: string | null | undefined): void {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
  }

  async getById(actorRole: string, actorStaffRole: string | null | undefined, id: string) {
    assertAdminAccess(actorRole, actorStaffRole, USERS_DIRECTORY_ACCESS);
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
    if (targetUserId === actorUserId && targetStaff !== actorStaff) {
      throw cannotChangeOwnRoleError();
    }
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaff)) {
      throw new AuthzError("Forbidden");
    }

    if (normalizedRole === "staff") {
      if (targetStaff == null) {
        throw new AuthzError("staffRole is required when role is staff", 400);
      }
      await this.applyRoles(targetUserId, "staff", targetStaff, actorUserId);
      return;
    }

    if (targetStaff != null) {
      throw new AuthzError("staffRole must be omitted when role is client", 400);
    }
    await this.applyRoles(targetUserId, "client", null, actorUserId);
  }

  /** Persists a role change; the last active super_admin guard runs under a roster lock. */
  private async applyRoles(
    targetUserId: string,
    role: string,
    staffRole: string | null,
    actorUserId: string,
  ): Promise<void> {
    try {
      await this.roles.setRoleAndStaff(targetUserId, role, staffRole, actorUserId);
    } catch (error) {
      if (error instanceof LastSuperAdminError) throw lastSuperAdminError();
      throw error;
    }
  }

  async setStaffRole(
    actorRole: string,
    actorUserId: string,
    targetUserId: string,
    staffRole: UserStaffRole | null,
    actorStaffRole?: string | null,
  ) {
    const actorStaff = normalizeUserStaffRole(actorStaffRole);
    if (!roleHasCapability(actorRole as UserRole, "user.invite", actorStaff)) {
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
    await this.applyRoles(targetUserId, "staff", staffRole, actorUserId);
  }

  async suspend(actor: AdminActor, userId: string, reason: string): Promise<void> {
    await this.suspendMany(actor, [userId], reason, false);
  }

  async unsuspend(actor: AdminActor, userId: string): Promise<void> {
    await this.unsuspendMany(actor, [userId], false);
  }

  /**
   * Suspends every account in one transaction with the actor and reason on each audit event.
   * You cannot suspend yourself, and only a super_admin can suspend a staff account.
   */
  async suspendMany(
    actor: AdminActor,
    userIds: string[],
    reason: string,
    bulk: boolean,
  ): Promise<void> {
    assertAdminAccess(actor.role, actor.staffRole, USER_MODERATION_ACCESS);
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
    assertAdminAccess(actor.role, actor.staffRole, USER_MODERATION_ACCESS);
    const ids = [...new Set(userIds)];
    await this.assertModeratable(actor, ids);
    await this.suspender.unsuspendMany({ userIds: ids, actorUserId: actor.userId, bulk });
    await this.invalidateSuspension(ids);
  }

  /** Every target must exist, and staff accounts are moderated by a super_admin only. */
  private async assertModeratable(actor: AdminActor, ids: string[]): Promise<void> {
    const targets = await this.reader.getByIds(ids);
    if (targets.length !== ids.length) throw new AuthzError("User not found", 404);
    const touchesStaff = targets.some((t) => normalizeUserRole(t.role) === "staff");
    if (touchesStaff && normalizeUserStaffRole(actor.staffRole) !== "super_admin") {
      throw new AuthzError("Only a platform admin can suspend or restore a staff account", 403, {
        code: "staff_moderation_requires_super_admin",
      });
    }
  }

  private async invalidateSuspension(ids: string[]): Promise<void> {
    if (!this.suspensionCacheInvalidator) return;
    await Promise.all(ids.map((id) => this.suspensionCacheInvalidator?.invalidate(id)));
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
