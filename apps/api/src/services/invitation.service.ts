import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IEmailService } from "@auction/email";
import type {
  IUserInvitationRepository,
  InvitationAdminListFilters,
  InvitationAdminListRow,
} from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import {
  type UserRole,
  type UserStaffRole,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";

export type InvitationError = { message: string; status: number };

export type CreateInvitationInput = {
  actorUserId: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole?: UserStaffRole | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

/**
 * Admin lifecycle of platform invitations (create / list / revoke / resend / preview).
 * Registration-time validation and consumption live in InvitationConsumptionService.
 */
export class InvitationService {
  constructor(
    private readonly invites: IUserInvitationRepository,
    private readonly users: IUserRepository,
    private readonly email: IEmailService,
    private readonly webOrigin: string,
  ) {}

  private inviteLink(token: string): string {
    const base = this.webOrigin.replace(/\/$/, "");
    return `${base}/register?invite=${encodeURIComponent(token)}`;
  }

  private async requireInviteCapability(
    actorUserId: string,
  ): Promise<Result<{ name: string | null }, InvitationError>> {
    const actor = await this.users.findById(actorUserId);
    const actorRole = (actor?.role ?? "client") as UserRole;
    const actorStaff = normalizeUserStaffRole(actor?.staffRole ?? undefined);
    if (!roleHasCapability(actorRole, "user.invite", actorStaff)) {
      return err({ message: "Forbidden", status: 403 });
    }
    return ok({ name: actor?.name ?? null });
  }

  /** Best-effort invite email: a queue outage must not lose the created invitation
   * (admins can resend), so enqueue failures are logged and swallowed. */
  private async enqueueInviteEmail(args: {
    invitationId: string;
    token: string;
    email: string;
    inviterName: string | null;
    targetRole: UserRole;
    targetStaffRole: UserStaffRole | null;
    expiresAt: Date;
  }): Promise<void> {
    try {
      const { outboxId } = await this.email.enqueue({
        template: "invite",
        to: args.email,
        category: "transactional",
        vars: {
          inviteUrl: this.inviteLink(args.token),
          inviterName: args.inviterName,
          inviteeEmail: args.email,
          role: args.targetRole,
          staffRole: args.targetStaffRole,
          expiresAt: args.expiresAt.toISOString(),
        },
      });
      await this.invites.updateStatus(args.invitationId, { lastEmailOutboxId: outboxId });
    } catch (e) {
      console.error("[invitations] invite email enqueue failed (invite kept, resend available)", {
        invitationId: args.invitationId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>> {
    const actor = await this.requireInviteCapability(input.actorUserId);
    if (actor.isErr()) return err(actor.error);

    if (input.targetRole !== "staff" && input.targetStaffRole != null) {
      return err({
        message: "targetStaffRole is only valid for staff invitations",
        status: 400,
      });
    }
    const targetStaff = input.targetRole === "staff" ? (input.targetStaffRole ?? null) : null;
    if (input.targetRole === "staff" && targetStaff == null) {
      return err({ message: "targetStaffRole is required for staff invitations", status: 400 });
    }

    const email = input.email.trim().toLowerCase();

    const existingUser = await this.users.findByEmail(email);
    if (existingUser) {
      return err({ message: "A user with this email already exists", status: 409 });
    }
    const existingInvite = await this.invites.findPendingPlatformByEmail(email);
    if (existingInvite) {
      return err({
        message: "A pending invitation already exists for this email",
        status: 409,
      });
    }

    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = addDays(new Date(), 7);

    try {
      await this.invites.insert({
        id,
        email,
        targetRole: input.targetRole,
        targetStaffRole: targetStaff,
        tokenHash: hashToken(token),
        status: "pending",
        expiresAt,
        acceptedAt: null,
        acceptedUserId: null,
        createdByUserId: input.actorUserId,
      });
    } catch (e) {
      // Partial unique index race: another admin created the invite concurrently.
      if (isUniqueViolation(e)) {
        return err({
          message: "A pending invitation already exists for this email",
          status: 409,
        });
      }
      throw e;
    }

    await this.enqueueInviteEmail({
      invitationId: id,
      token,
      email,
      inviterName: actor.value.name,
      targetRole: input.targetRole,
      targetStaffRole: targetStaff,
      expiresAt,
    });

    return ok({ id, expiresAt });
  }

  async preview(token: string): Promise<
    Result<
      {
        email: string;
        targetRole: UserRole;
        targetStaffRole: UserStaffRole | null;
        expiresAt: Date;
        entityScoped: boolean;
      },
      InvitationError
    >
  > {
    const row = await this.invites.findPendingByTokenHash(hashToken(token));
    if (!row) return err({ message: "Invalid invitation", status: 404 });
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.invites.updateStatus(row.id, { status: "expired" });
      return err({ message: "Invitation expired", status: 400 });
    }

    await this.invites.markOpenedFirstTouch(row.id);

    return ok({
      email: row.email,
      targetRole: row.targetRole,
      targetStaffRole: row.targetStaffRole,
      expiresAt: row.expiresAt,
      entityScoped: row.targetLegalEntityId != null,
    });
  }

  async listInvitations(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<{
    rows: InvitationAdminListRow[];
    total: number;
    pendingTotal: number;
    acceptedTotal: number;
  }> {
    const [rows, counts] = await Promise.all([
      this.invites.listAdmin(filters, page),
      this.invites.counts(filters),
    ]);
    return {
      rows,
      total: counts.total,
      pendingTotal: counts.pending,
      acceptedTotal: counts.accepted,
    };
  }

  /** Any admin with `user.invite` may revoke, not just the creator (the creating
   * admin may be unavailable or offboarded). */
  async revoke(input: { actorUserId: string; invitationId: string }): Promise<
    Result<void, InvitationError>
  > {
    const actor = await this.requireInviteCapability(input.actorUserId);
    if (actor.isErr()) return err(actor.error);
    const row = await this.invites.findById(input.invitationId);
    if (!row) {
      return err({ message: "Not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Invitation cannot be revoked", status: 400 });
    }
    await this.invites.updateStatus(row.id, { status: "revoked" });
    return ok(undefined);
  }

  /** Any admin with `user.invite` may resend; the token is rotated so old links die. */
  async resend(input: {
    actorUserId: string;
    invitationId: string;
  }): Promise<Result<{ expiresAt: Date }, InvitationError>> {
    const actor = await this.requireInviteCapability(input.actorUserId);
    if (actor.isErr()) return err(actor.error);
    const row = await this.invites.findById(input.invitationId);
    if (!row) {
      return err({ message: "Not found", status: 404 });
    }
    if (row.status !== "pending" && row.status !== "expired") {
      return err({ message: "Invitation cannot be resent", status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = addDays(new Date(), 7);
    const patch: Parameters<IUserInvitationRepository["updateStatus"]>[1] = {
      tokenHash: hashToken(token),
      expiresAt,
    };
    if (row.status === "expired") {
      patch.status = "pending";
      patch.openedAt = null;
    }
    await this.invites.updateStatus(row.id, patch);

    await this.enqueueInviteEmail({
      invitationId: row.id,
      token,
      email: row.email,
      inviterName: actor.value.name,
      targetRole: row.targetRole,
      targetStaffRole: row.targetStaffRole,
      expiresAt,
    });

    return ok({ expiresAt });
  }
}
