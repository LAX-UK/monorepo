import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { IEmailService } from "@auction/email";
import type {
  IUserInvitationRepository,
  InvitationAdminListFilters,
  InvitationAdminListRow,
} from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import {
  type LaxStaffGrant,
  type UserRole,
  type UserStaffRole,
  laxStaffPlatform,
  laxStaffRoleOption,
  normalizeLaxStaffGrants,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { type Result, err, ok } from "neverthrow";

export type InvitationError = { message: string; status: number };

export type CreateInvitationInput = {
  actorUserId: string;
  email: string;
  /** Legacy single-platform shape; ignored when `grants` is non-empty. */
  targetRole?: UserRole;
  targetStaffRole?: UserStaffRole | null;
  /** Staff role per LAX platform. Any grant makes this a staff invitation. */
  grants?: readonly { product: string; role: string }[];
};

type ResolvedInvitationAccess = {
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  grants: LaxStaffGrant[];
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

/** Path the invitee lands on after accepting, listing the platforms they can now open. */
export function invitationWelcomePath(grants: readonly LaxStaffGrant[]): string {
  const platforms = grants.map((g) => g.product).join(",");
  return platforms ? `/invitations/welcome?platforms=${platforms}` : "/invitations/welcome";
}

function resolveInvitationAccess(
  input: Pick<CreateInvitationInput, "targetRole" | "targetStaffRole" | "grants">,
): Result<ResolvedInvitationAccess, InvitationError> {
  if (input.grants && input.grants.length > 0) {
    const normalized = normalizeLaxStaffGrants(input.grants);
    if (!normalized.ok) return err({ message: normalized.message, status: 400 });
    const bid = normalized.grants.find((g) => g.product === "bid");
    return ok({
      targetRole: bid ? "staff" : "client",
      targetStaffRole: bid ? (bid.role as UserStaffRole) : null,
      grants: normalized.grants,
    });
  }
  const targetRole = input.targetRole ?? "client";
  if (targetRole !== "staff" && input.targetStaffRole != null) {
    return err({ message: "targetStaffRole is only valid for staff invitations", status: 400 });
  }
  if (targetRole === "staff") {
    if (input.targetStaffRole == null) {
      return err({ message: "targetStaffRole is required for staff invitations", status: 400 });
    }
    return ok({
      targetRole,
      targetStaffRole: input.targetStaffRole,
      grants: [{ product: "bid", role: input.targetStaffRole }],
    });
  }
  return ok({ targetRole, targetStaffRole: null, grants: [] });
}

function emailGrantRows(grants: readonly LaxStaffGrant[]) {
  if (grants.length === 0) {
    return [{ platform: "London Art Exchange", role: "Client account" }];
  }
  return grants.map((g) => {
    const option = laxStaffRoleOption(g.product, g.role);
    return {
      platform: laxStaffPlatform(g.product).label,
      role: option?.label ?? g.role,
      summary: option?.summary ?? null,
    };
  });
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

  private inviteLink(token: string, grants: readonly LaxStaffGrant[], existingAccount: boolean) {
    const base = this.webOrigin.replace(/\/$/, "");
    if (existingAccount) {
      return `${base}/invitations/accept/${encodeURIComponent(token)}`;
    }
    const params = new URLSearchParams({ invite: token, next: invitationWelcomePath(grants) });
    return `${base}/register?${params.toString()}`;
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
    grants: readonly LaxStaffGrant[];
    expiresAt: Date;
  }): Promise<void> {
    try {
      const existingAccount = (await this.users.findByEmail(args.email)) != null;
      const { outboxId } = await this.email.enqueue({
        template: "access-invite",
        to: args.email,
        category: "transactional",
        vars: {
          scope: "staff",
          inviterName: args.inviterName,
          inviteeEmail: args.email,
          grants: emailGrantRows(args.grants),
          existingAccount,
          actionUrl: this.inviteLink(args.token, args.grants, existingAccount),
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

    const access = resolveInvitationAccess(input);
    if (access.isErr()) return err(access.error);
    const { targetRole, targetStaffRole, grants } = access.value;

    const email = input.email.trim().toLowerCase();

    // Existing accounts can receive staff access; a client invite would grant nothing.
    if (grants.length === 0 && (await this.users.findByEmail(email))) {
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
        targetRole,
        targetStaffRole,
        tokenHash: hashToken(token),
        status: "pending",
        expiresAt,
        acceptedAt: null,
        acceptedUserId: null,
        createdByUserId: input.actorUserId,
        grants,
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
      grants,
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
        grants: LaxStaffGrant[];
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
      grants: await this.invites.listGrants(row.id),
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
      grants: await this.invites.listGrants(row.id),
      expiresAt,
    });

    return ok({ expiresAt });
  }
}
