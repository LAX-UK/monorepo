import { createHash } from "node:crypto";
import type {
  ConsumeInviteResult,
  IUserInvitationRepository,
  InvitationRow,
} from "@auction/persistence/interfaces";
import { type LaxStaffGrant, type UserRole, bidStaffRolesFromGrants } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { InvitationError } from "./invitation.service.js";
import {
  type IStaffAccessWriter,
  type SetStaffAccessInput,
  StaffRoleAssignmentRefused,
} from "./staff/staff-role-assignment.service.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Registration-time invite handling: validate and consume on signup. */
export interface IInvitationConsumption {
  validateForRegistration(
    token: string,
    email: string,
  ): Promise<Result<InvitationRow, InvitationError>>;
  consumeInviteForNewUser(
    token: string,
    newUserId: string,
    email: string,
  ): Promise<Result<UserRole, InvitationError>>;
  /** Signed-in existing account accepting a staff invitation sent to its email. */
  acceptForExistingUser(
    token: string,
    userId: string,
    email: string,
  ): Promise<Result<{ grants: LaxStaffGrant[] }, InvitationError>>;
}

export type InvitationAcceptanceScope = {
  invitations: Pick<IUserInvitationRepository, "accept">;
  staffAccess: IStaffAccessWriter;
};

/** Accepting an invitation and applying the Bid access it grants commit together or not at all. */
export interface IInvitationAcceptanceUnitOfWork {
  run<T>(work: (scope: InvitationAcceptanceScope) => Promise<T>): Promise<T>;
}

type AcceptedInvite = Extract<ConsumeInviteResult, { outcome: "ok" }>;
type Acceptor = "new_user" | "existing_user";
type BidAccess = Pick<SetStaffAccessInput, "role" | "staffRoles">;

/**
 * The Bid access an accepted invitation gives. Bid grants make the person staff with every role
 * granted. Without one, a new account takes the invitation's base role, and an existing account
 * keeps the access it has.
 */
export function bidAccessFromInvite(invite: AcceptedInvite, acceptor: Acceptor): BidAccess | null {
  const bidRoles = bidStaffRolesFromGrants(invite.grants);
  if (invite.grants.some((g) => g.product === "bid")) {
    return { role: "staff", staffRoles: bidRoles };
  }
  if (acceptor === "existing_user") return null;
  return {
    role: invite.targetRole,
    staffRoles:
      invite.targetRole === "staff" && invite.targetStaffRole ? [invite.targetStaffRole] : [],
  };
}

function consumeError(result: Exclude<ConsumeInviteResult, { outcome: "ok" }>): InvitationError {
  switch (result.outcome) {
    case "expired":
      return { message: "Invitation expired", status: 400 };
    case "email_mismatch":
      return { message: "Email does not match invitation", status: 400 };
    default:
      return { message: "Invalid invitation", status: 400 };
  }
}

const refusedError = (error: StaffRoleAssignmentRefused): InvitationError => ({
  message:
    error.reason === "last_administrator"
      ? "Accepting would remove the last active administrator"
      : "This invitation's roles cannot be combined with your current roles",
  status: 409,
});

/**
 * Owns the registration side of invitations, separate from the admin lifecycle
 * ({@link InvitationService}). The invitation is consumed and its Bid access applied through the
 * staff roster in one unit of work.
 */
export class InvitationConsumptionService implements IInvitationConsumption {
  constructor(
    private readonly invites: Pick<
      IUserInvitationRepository,
      "findPendingByTokenHash" | "updateStatus"
    >,
    private readonly acceptance: IInvitationAcceptanceUnitOfWork,
  ) {}

  /** Validates an invite for a registration attempt and returns the invitation row snapshot. */
  async validateForRegistration(
    token: string,
    email: string,
  ): Promise<Result<InvitationRow, InvitationError>> {
    const row = await this.invites.findPendingByTokenHash(hashToken(token));
    if (!row) return err({ message: "Invalid invitation", status: 400 });
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.invites.updateStatus(row.id, { status: "expired" });
      return err({ message: "Invitation expired", status: 400 });
    }
    // Case-insensitive: legacy rows may predate lowercase-on-insert.
    if (row.email.toLowerCase() !== email.trim().toLowerCase()) {
      return err({ message: "Email does not match invitation", status: 400 });
    }
    return ok(row);
  }

  async consumeInviteForNewUser(
    token: string,
    newUserId: string,
    email: string,
  ): Promise<Result<UserRole, InvitationError>> {
    const accepted = await this.acceptAndApply(token, newUserId, email, "new_user");
    return accepted.map(({ invite, access }) => access?.role ?? invite.targetRole);
  }

  async acceptForExistingUser(
    token: string,
    userId: string,
    email: string,
  ): Promise<Result<{ grants: LaxStaffGrant[] }, InvitationError>> {
    const row = await this.invites.findPendingByTokenHash(hashToken(token));
    if (row?.targetLegalEntityId != null) {
      return err({ message: "Invalid invitation", status: 400 });
    }
    const accepted = await this.acceptAndApply(token, userId, email, "existing_user");
    return accepted.map(({ invite }) => ({ grants: invite.grants }));
  }

  private async acceptAndApply(
    token: string,
    userId: string,
    email: string,
    acceptor: Acceptor,
  ): Promise<Result<{ invite: AcceptedInvite; access: BidAccess | null }, InvitationError>> {
    try {
      const outcome = await this.acceptance.run(async ({ invitations, staffAccess }) => {
        const result = await invitations.accept(hashToken(token), userId, email);
        if (result.outcome !== "ok") return { result, access: null };
        const access = bidAccessFromInvite(result, acceptor);
        if (access) {
          await staffAccess.setAccess({
            userId,
            ...access,
            actorUserId: result.invitedByUserId,
            reason: "Accepted staff invitation",
            invitationId: result.invitationId,
          });
        }
        return { result, access };
      });
      if (outcome.result.outcome !== "ok") return err(consumeError(outcome.result));
      return ok({ invite: outcome.result, access: outcome.access });
    } catch (error) {
      if (error instanceof StaffRoleAssignmentRefused) return err(refusedError(error));
      throw error;
    }
  }
}
