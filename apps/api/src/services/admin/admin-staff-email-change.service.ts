import type { IAdminUserDetailReader, IAdminUserKycReader } from "@auction/persistence/interfaces";
import {
  ADMINISTRATOR_STAFF_ROLE,
  NO_STAFF_ROLES,
  STAFF_EMAIL_CHANGE_ACCESS,
  type StaffRoles,
  type UserRole,
  hasStaffRole,
  userHasAccessTo,
} from "@auction/types";
import type {
  AdminEmailChangeKycRecord,
  AdminStaffEmailChangeBody,
  AdminStaffEmailChangeCancelBody,
} from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { IdentityIssuerClientError } from "../../infrastructure/http-identity-issuer.client.js";
import type { IAuthAuditPublisher } from "../interfaces/auth-audit-publisher.js";
import type { IIdentityStaffEmailChangeClient } from "../interfaces/identity-issuer-client.js";

export const STAFF_EMAIL_CHANGE_REQUESTED_EVENT = "auth.email_change_requested_by_staff";
export const STAFF_EMAIL_CHANGE_CANCEL_REQUESTED_EVENT =
  "auth.email_change_cancel_requested_by_staff";
export const STAFF_EMAIL_CHANGE_KYC_VIEWED_EVENT = "auth.email_change_kyc_record_viewed";

export type StaffEmailChangeActor = {
  userId: string;
  role: string;
  staffRoles: StaffRoles | undefined;
};

export type StaffEmailChangeError = { status: 403 | 404 | 409 | 422 | 502; message: string };

const IDENTITY_REFUSALS: Readonly<Record<string, StaffEmailChangeError>> = {
  subject_not_found: { status: 404, message: "User not found" },
  same_email: { status: 409, message: "That is already this account's email address." },
  email_taken: {
    status: 409,
    message: "Another account already uses that address, or is waiting to change to it.",
  },
  none_in_progress: {
    status: 409,
    message:
      "No email change is waiting for this person. It may already be done, cancelled or have lapsed.",
  },
};

const UNAVAILABLE: StaffEmailChangeError = {
  status: 502,
  message: "The sign-in service could not start the change. Try again.",
};

/**
 * Helps someone who has lost the inbox their account is registered to. The self-service change
 * needs both inboxes, so this is the way through, and it is deliberately narrow:
 *  - only roles with the email-change rule may use it, and never on their own account;
 *  - a staff account can only be moved by an Administrator;
 *  - a reason and a proof are required. A "KYC match" must point at a verified KYC record of
 *    that person, so a claim of a match cannot name a record that does not exist;
 *  - the request is recorded before Identity is asked to act, so there is never a change
 *    without an audit entry. The addresses themselves stay out of the entry.
 * Identity then sends the person a link at the new address, tells the old address, and signs
 * the account out everywhere. The address moves only when the person follows the link.
 */
export class AdminStaffEmailChangeService {
  constructor(
    private readonly deps: {
      identity: IIdentityStaffEmailChangeClient;
      users: Pick<IAdminUserDetailReader, "getById">;
      kyc: Pick<IAdminUserKycReader, "listSessionsForUser">;
      audit: IAuthAuditPublisher;
    },
  ) {}

  /** The verified name and date of birth staff compare with what the caller says. */
  async kycRecord(
    actor: StaffEmailChangeActor,
    targetUserId: string,
  ): Promise<Result<AdminEmailChangeKycRecord | null, StaffEmailChangeError>> {
    const refused = this.refuse(actor, targetUserId);
    if (refused) return err(refused);
    const target = await this.deps.users.getById(targetUserId);
    if (!target) return err({ status: 404, message: "User not found" });
    const record = await this.latestVerifiedRecord(targetUserId);
    if (record) {
      await this.deps.audit.publish({
        eventType: STAFF_EMAIL_CHANGE_KYC_VIEWED_EVENT,
        aggregateType: "user",
        aggregateId: targetUserId,
        actorUserId: actor.userId,
        payload: { kycSessionId: record.sessionId },
      });
    }
    return ok(record);
  }

  async change(
    actor: StaffEmailChangeActor,
    targetUserId: string,
    body: AdminStaffEmailChangeBody,
  ): Promise<Result<{ pendingEmail: string }, StaffEmailChangeError>> {
    const refused = this.refuse(actor, targetUserId);
    if (refused) return err(refused);
    const target = await this.deps.users.getById(targetUserId);
    if (!target) return err({ status: 404, message: "User not found" });
    if (
      target.role === "staff" &&
      !hasStaffRole(actor.staffRoles ?? NO_STAFF_ROLES, ADMINISTRATOR_STAFF_ROLE)
    ) {
      return err({ status: 403, message: "Only a platform admin can change a staff account" });
    }
    if (body.proof.kind === "kyc_match") {
      const record = await this.latestVerifiedRecord(targetUserId);
      if (!record || record.sessionId !== body.proof.kycSessionId) {
        return err({
          status: 422,
          message: "There is no verified KYC record to match. Use a fresh ID check instead.",
        });
      }
    }
    await this.deps.audit.publish({
      eventType: STAFF_EMAIL_CHANGE_REQUESTED_EVENT,
      aggregateType: "user",
      aggregateId: targetUserId,
      actorUserId: actor.userId,
      payload: {
        reason: body.reason,
        proofKind: body.proof.kind,
        ...(body.proof.kind === "kyc_match"
          ? { kycSessionId: body.proof.kycSessionId }
          : { proofReference: body.proof.reference }),
      },
    });
    try {
      const started = await this.deps.identity.startStaffAssistedEmailChange({
        subjectId: targetUserId,
        newEmail: body.newEmail,
        actorUserId: actor.userId,
        reason: body.reason,
        proof: body.proof,
      });
      return ok(started);
    } catch (error) {
      const code = error instanceof IdentityIssuerClientError ? error.code : undefined;
      return err((code && IDENTITY_REFUSALS[code]) || UNAVAILABLE);
    }
  }

  /**
   * Withdraws a change that is waiting for the person to follow its link. It needs the same rule
   * as starting one (and a fresh sign-in, asked for by the route), the same limits on who may be
   * acted on, and a reason. The request is recorded before Identity is asked to act. Identity
   * clears the pending address, which ends the emailed link; the sessions that starting the change
   * ended stay ended.
   */
  async cancel(
    actor: StaffEmailChangeActor,
    targetUserId: string,
    body: AdminStaffEmailChangeCancelBody,
  ): Promise<Result<{ cancelled: true }, StaffEmailChangeError>> {
    const refused = this.refuse(actor, targetUserId);
    if (refused) return err(refused);
    const target = await this.deps.users.getById(targetUserId);
    if (!target) return err({ status: 404, message: "User not found" });
    if (
      target.role === "staff" &&
      !hasStaffRole(actor.staffRoles ?? NO_STAFF_ROLES, ADMINISTRATOR_STAFF_ROLE)
    ) {
      return err({ status: 403, message: "Only a platform admin can change a staff account" });
    }
    await this.deps.audit.publish({
      eventType: STAFF_EMAIL_CHANGE_CANCEL_REQUESTED_EVENT,
      aggregateType: "user",
      aggregateId: targetUserId,
      actorUserId: actor.userId,
      payload: { reason: body.reason },
    });
    try {
      await this.deps.identity.cancelStaffAssistedEmailChange({
        subjectId: targetUserId,
        actorUserId: actor.userId,
        reason: body.reason,
      });
      return ok({ cancelled: true });
    } catch (error) {
      const code = error instanceof IdentityIssuerClientError ? error.code : undefined;
      return err((code && IDENTITY_REFUSALS[code]) || UNAVAILABLE);
    }
  }

  private refuse(actor: StaffEmailChangeActor, targetUserId: string): StaffEmailChangeError | null {
    if (!userHasAccessTo(actor.role as UserRole, actor.staffRoles, STAFF_EMAIL_CHANGE_ACCESS)) {
      return { status: 403, message: "Forbidden" };
    }
    if (actor.userId === targetUserId) {
      return {
        status: 403,
        message: "Change your own email address from LAX Account, not from the staff tools",
      };
    }
    return null;
  }

  private async latestVerifiedRecord(userId: string): Promise<AdminEmailChangeKycRecord | null> {
    const sessions = await this.deps.kyc.listSessionsForUser(userId, 20);
    const session = sessions.find(
      (candidate) =>
        candidate.status === "verified" &&
        candidate.verifiedFirstName &&
        candidate.verifiedLastName &&
        candidate.verifiedDateOfBirth,
    );
    if (!session?.verifiedFirstName || !session.verifiedLastName || !session.verifiedDateOfBirth) {
      return null;
    }
    return {
      sessionId: session.id,
      firstName: session.verifiedFirstName,
      lastName: session.verifiedLastName,
      dateOfBirth: session.verifiedDateOfBirth,
      verifiedAt: session.decisionAt ? session.decisionAt.toISOString() : null,
    };
  }
}
