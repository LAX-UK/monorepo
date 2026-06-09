import { createHash } from "node:crypto";
import type { UserRole } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type { IUserInvitationRepository, InvitationRow } from "./interfaces/invitation.js";
import type { InvitationError } from "./invitation.service.js";

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
}

/**
 * Owns the registration side of invitations, separate from the admin lifecycle
 * ({@link InvitationService}). Persistence (including the consume transaction)
 * lives behind {@link IUserInvitationRepository}.
 */
export class InvitationConsumptionService implements IInvitationConsumption {
  constructor(private readonly invites: IUserInvitationRepository) {}

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
    const result = await this.invites.consumeForNewUser(hashToken(token), newUserId, email);
    switch (result.outcome) {
      case "ok":
        return ok(result.targetRole);
      case "expired":
        return err({ message: "Invitation expired", status: 400 });
      case "email_mismatch":
        return err({ message: "Email does not match invitation", status: 400 });
      default:
        return err({ message: "Invalid invitation", status: 400 });
    }
  }
}
