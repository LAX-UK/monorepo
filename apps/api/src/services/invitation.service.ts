import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { user, userInvitation } from "@auction/db/schema";
import { type UserRole, roleHasCapability } from "@auction/types";
import { eq } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import type {
  IUserInvitationRepository,
  InvitationRow,
  InvitationSummary,
} from "./interfaces/invitation.js";
import type { IEmailService } from "./interfaces/email.js";
import type { IUserRepository } from "./interfaces/repositories.js";

export type InvitationError = { message: string; status: number };

class InvitationHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "InvitationHttpError";
  }
}

export type CreateInvitationInput = {
  actorUserId: string;
  email: string;
  targetRole: UserRole;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

export class InvitationService {
  constructor(
    private readonly db: Database,
    private readonly invites: IUserInvitationRepository,
    private readonly users: IUserRepository,
    private readonly email: IEmailService,
    private readonly webOrigin: string,
  ) {}

  private inviteLink(token: string): string {
    const base = this.webOrigin.replace(/\/$/, "");
    return `${base}/register?invite=${encodeURIComponent(token)}`;
  }

  async create(
    input: CreateInvitationInput,
  ): Promise<Result<{ id: string; expiresAt: Date }, InvitationError>> {
    const actor = await this.users.findById(input.actorUserId);
    const actorRole = (actor?.role ?? "client") as UserRole;
    if (!roleHasCapability(actorRole, "user.invite")) {
      return err({ message: "Forbidden", status: 403 });
    }

    const id = randomUUID();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = addDays(new Date(), 7);

    await this.invites.insert({
      id,
      email: input.email.trim().toLowerCase(),
      targetRole: input.targetRole,
      tokenHash,
      status: "pending",
      expiresAt,
      acceptedAt: null,
      acceptedUserId: null,
      createdByUserId: input.actorUserId,
    });

    await this.email.enqueue({
      template: "invite",
      to: input.email.trim(),
      category: "transactional",
      vars: {
        inviteUrl: this.inviteLink(token),
        inviterName: actor?.name ?? null,
        inviteeEmail: input.email.trim(),
        role: input.targetRole,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return ok({ id, expiresAt });
  }

  async preview(
    token: string,
  ): Promise<Result<{ email: string; targetRole: UserRole; expiresAt: Date }, InvitationError>> {
    const row = await this.invites.findPendingByTokenHash(hashToken(token));
    if (!row) return err({ message: "Invalid invitation", status: 404 });
    if (row.expiresAt.getTime() <= Date.now()) {
      await this.invites.updateStatus(row.id, { status: "expired" });
      return err({ message: "Invitation expired", status: 400 });
    }
    return ok({ email: row.email, targetRole: row.targetRole, expiresAt: row.expiresAt });
  }

  /**
   * Validates an invite for a registration attempt and returns the invitation row snapshot.
   * Consumption happens in {@link consumeInviteForNewUser} after the auth user is created.
   */
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
    if (row.email !== email.trim().toLowerCase()) {
      return err({ message: "Email does not match invitation", status: 400 });
    }
    return ok(row);
  }

  async consumeInviteForNewUser(
    token: string,
    newUserId: string,
    email: string,
  ): Promise<Result<UserRole, InvitationError>> {
    try {
      const targetRole = await this.db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(userInvitation)
          .where(eq(userInvitation.tokenHash, hashToken(token)))
          .limit(1);
        if (!row || row.status !== "pending") {
          throw new InvitationHttpError("Invalid invitation", 400);
        }
        if (row.expiresAt.getTime() <= Date.now()) {
          await tx
            .update(userInvitation)
            .set({ status: "expired", updatedAt: new Date() })
            .where(eq(userInvitation.id, row.id));
          throw new InvitationHttpError("Invitation expired", 400);
        }
        if (row.email !== email.trim().toLowerCase()) {
          throw new InvitationHttpError("Email does not match invitation", 400);
        }

        const nextRole = row.targetRole as UserRole;

        await tx
          .update(userInvitation)
          .set({
            status: "accepted",
            acceptedAt: new Date(),
            acceptedUserId: newUserId,
            updatedAt: new Date(),
          })
          .where(eq(userInvitation.id, row.id));

        await tx
          .update(user)
          .set({ role: nextRole, updatedAt: new Date() })
          .where(eq(user.id, newUserId));
        return nextRole;
      });
      return ok(targetRole);
    } catch (e) {
      if (e instanceof InvitationHttpError) {
        return err({ message: e.message, status: e.status });
      }
      throw e;
    }
  }

  async listPendingForActor(actorUserId: string): Promise<InvitationSummary[]> {
    return this.invites.listPendingCreatedBy(actorUserId);
  }

  async revoke(input: { actorUserId: string; invitationId: string }): Promise<
    Result<void, InvitationError>
  > {
    const actor = await this.users.findById(input.actorUserId);
    const actorRole = (actor?.role ?? "client") as UserRole;
    if (!roleHasCapability(actorRole, "user.invite")) {
      return err({ message: "Forbidden", status: 403 });
    }
    const row = await this.invites.findById(input.invitationId);
    if (!row || row.createdByUserId !== input.actorUserId) {
      return err({ message: "Not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Invitation cannot be revoked", status: 400 });
    }
    await this.invites.updateStatus(row.id, { status: "revoked" });
    return ok(undefined);
  }

  async resend(input: {
    actorUserId: string;
    invitationId: string;
  }): Promise<Result<{ expiresAt: Date }, InvitationError>> {
    const actor = await this.users.findById(input.actorUserId);
    const actorRole = (actor?.role ?? "client") as UserRole;
    if (!roleHasCapability(actorRole, "user.invite")) {
      return err({ message: "Forbidden", status: 403 });
    }
    const row = await this.invites.findById(input.invitationId);
    if (!row || row.createdByUserId !== input.actorUserId) {
      return err({ message: "Not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Invitation cannot be resent", status: 400 });
    }

    const token = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = addDays(new Date(), 7);
    await this.invites.updateStatus(row.id, { tokenHash, expiresAt });

    await this.email.enqueue({
      template: "invite",
      to: row.email,
      category: "transactional",
      vars: {
        inviteUrl: this.inviteLink(token),
        inviterName: actor?.name ?? null,
        inviteeEmail: row.email,
        role: row.targetRole,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return ok({ expiresAt });
  }
}
