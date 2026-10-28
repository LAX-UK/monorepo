import type { IAdminUserDetailReader } from "@auction/persistence/interfaces";
import {
  ADMINISTRATOR_STAFF_ROLE,
  NO_STAFF_ROLES,
  type StaffRoles,
  USER_MODERATION_ACCESS,
  type UserRole,
  hasStaffRole,
  userHasAccessTo,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { IIdentityTwoFactorPolicyClient } from "../interfaces/identity-issuer-client.js";

const TWO_FACTOR_RESET_EVENT = "auth.two_factor_reset_by_staff";

export type TwoFactorResetActor = {
  userId: string;
  role: string;
  staffRoles: StaffRoles | undefined;
};

export type TwoFactorResetError = { status: 403 | 404 | 502; message: string };

/**
 * Support's way back in for someone who lost both their authenticator app and their backup
 * codes. It is deliberately narrow: the person must already exist, staff accounts can only be
 * reset by a platform admin (a support agent must not be able to weaken an admin's sign-in),
 * and every reset names a reason and is recorded before Identity is asked to act, so there is
 * never a reset without an audit entry. Identity removes the enrolment, signs the person out
 * everywhere and emails them.
 */
export class AdminTwoFactorResetService {
  constructor(
    private readonly deps: {
      identity: Pick<IIdentityTwoFactorPolicyClient, "resetTwoFactor">;
      users: Pick<IAdminUserDetailReader, "getById">;
      audit: IAuthAuditPublisher;
    },
  ) {}

  async reset(
    actor: TwoFactorResetActor,
    targetUserId: string,
    reason: string,
  ): Promise<Result<void, TwoFactorResetError>> {
    const staffRoles = actor.staffRoles;
    if (!userHasAccessTo(actor.role as UserRole, staffRoles, USER_MODERATION_ACCESS)) {
      return err({ status: 403, message: "Forbidden" });
    }
    const target = await this.deps.users.getById(targetUserId);
    if (!target) return err({ status: 404, message: "User not found" });
    if (
      target.role === "staff" &&
      !hasStaffRole(actor.staffRoles ?? NO_STAFF_ROLES, ADMINISTRATOR_STAFF_ROLE)
    ) {
      return err({ status: 403, message: "Only a platform admin can reset a staff account" });
    }
    await this.deps.audit.publish({
      eventType: TWO_FACTOR_RESET_EVENT,
      aggregateType: "user",
      aggregateId: targetUserId,
      actorUserId: actor.userId,
      payload: { reason },
    });
    try {
      await this.deps.identity.resetTwoFactor(targetUserId);
    } catch (error) {
      const notFound = (error as { status?: number }).status === 404;
      return err(
        notFound
          ? { status: 404, message: "User not found" }
          : { status: 502, message: "The sign-in service could not reset it. Try again." },
      );
    }
    return ok(undefined);
  }
}
