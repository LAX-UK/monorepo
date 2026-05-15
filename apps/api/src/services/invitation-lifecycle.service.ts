import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, user, userInvitation } from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import { and, eq, isNull } from "drizzle-orm";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type {
  IInvitationLifecycleService,
  InvitationOutcome,
  InviteOutcome,
} from "./interfaces/invitation-lifecycle.js";
import type { InviteMemberInput } from "./interfaces/member-management.js";
import { MemberPermissionError } from "./interfaces/member-management.js";
import type { IMembershipInviteNotifier } from "./interfaces/membership-invite-notification.js";

const ADMIN_ROLES: LegalEntityMemberRole[] = ["owner", "admin"];

function rowToMember(row: typeof legalEntityMember.$inferSelect): LegalEntityMember {
  return {
    id: row.id,
    legalEntityId: row.legalEntityId,
    userId: row.userId,
    role: row.role,
    isPrimaryAdmin: row.isPrimaryAdmin,
    invitedByUserId: row.invitedByUserId ?? null,
    invitedAt: row.invitedAt ?? null,
    acceptedAt: row.acceptedAt ?? null,
    removedAt: row.removedAt ?? null,
    createdAt: row.createdAt,
  };
}

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + days);
  return x;
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

export class InvitationLifecycleService implements IInvitationLifecycleService {
  constructor(
    private readonly db: Database,
    private readonly domainEventPublisher: DomainEventPublisher,
    private readonly membershipInviteNotifier: IMembershipInviteNotifier,
    private readonly webOrigin: string,
  ) {}

  private async assertActorIsAdmin(
    actingUserId: string,
    legalEntityId: string,
  ): Promise<typeof legalEntityMember.$inferSelect> {
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.userId, actingUserId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    const me = rows[0];
    if (!me || !me.acceptedAt) {
      throw new MemberPermissionError("not_a_member");
    }
    if (!ADMIN_ROLES.includes(me.role)) {
      throw new MemberPermissionError("insufficient_role");
    }
    return me;
  }

  async invite(
    actingUserId: string,
    legalEntityId: string,
    input: InviteMemberInput,
  ): Promise<InviteOutcome> {
    await this.assertActorIsAdmin(actingUserId, legalEntityId);
    const email = normEmail(input.email);

    const token = await this.db.transaction(async (tx) => {
      const existingUserRows = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      const existingUser = existingUserRows[0];

      if (existingUser) {
        const existingMember = await tx
          .select({ id: legalEntityMember.id })
          .from(legalEntityMember)
          .where(
            and(
              eq(legalEntityMember.legalEntityId, legalEntityId),
              eq(legalEntityMember.userId, existingUser.id),
              isNull(legalEntityMember.removedAt),
            ),
          )
          .limit(1);
        if (existingMember.length > 0) {
          throw new MemberPermissionError("already_a_member");
        }
      }

      await tx
        .update(userInvitation)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(
          and(
            eq(userInvitation.email, email),
            eq(userInvitation.targetLegalEntityId, legalEntityId),
            eq(userInvitation.status, "pending"),
          ),
        );

      const id = randomUUID();
      const rawToken = randomBytes(32).toString("base64url");
      const tokenHash = hashToken(rawToken);
      const expiresAt = addDays(new Date(), 7);
      await tx.insert(userInvitation).values({
        id,
        email,
        targetRole: "client",
        tokenHash,
        status: "pending",
        expiresAt,
        acceptedAt: null,
        acceptedUserId: null,
        targetLegalEntityId: legalEntityId,
        targetLegalEntityMemberRole: input.role,
        createdByUserId: actingUserId,
      });
      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_invited",
        payload: {
          invitation_id: id,
          email,
          role: input.role,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
      return rawToken;
    });

    const [actor] = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, actingUserId))
      .limit(1);
    const [org] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    const inviterName = actor?.name ?? "A colleague";
    const orgName = org?.displayName ?? "Organisation";

    const existingUserRows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    const existingUser = existingUserRows[0];

    const base = this.webOrigin.replace(/\/$/, "");
    if (existingUser) {
      await this.membershipInviteNotifier.notify({
        kind: "invite_to_existing_user",
        to: email,
        orgName,
        inviterName,
        role: input.role,
        acceptUrl: `${base}/dashboard/invitations/accept/${encodeURIComponent(token)}`,
      });
    } else {
      await this.membershipInviteNotifier.notify({
        kind: "invite_to_new_user",
        to: email,
        orgName,
        inviterName,
        role: input.role,
        signupUrl: `${base}/register?invite=${encodeURIComponent(token)}`,
      });
    }

    return { memberId: null, invitationToken: token };
  }

  async accept(userId: string, userEmail: string, token: string): Promise<InvitationOutcome> {
    const tokenHash = hashToken(token);
    const emailNorm = normEmail(userEmail);

    const txResult = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(userInvitation)
        .where(eq(userInvitation.tokenHash, tokenHash))
        .limit(1);
      const invite = rows[0];
      if (!invite) return { ok: false as const, code: "invitation_not_found" };
      if (invite.status !== "pending") {
        return { ok: false as const, code: "invitation_not_pending" };
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        return { ok: false as const, code: "invitation_expired" };
      }
      if (!invite.targetLegalEntityId || !invite.targetLegalEntityMemberRole) {
        return { ok: false as const, code: "invitation_not_entity_scoped" };
      }
      if (normEmail(invite.email) !== emailNorm) {
        return { ok: false as const, code: "invitation_email_mismatch" };
      }

      const [member] = await tx
        .insert(legalEntityMember)
        .values({
          legalEntityId: invite.targetLegalEntityId,
          userId,
          role: invite.targetLegalEntityMemberRole as LegalEntityMemberRole,
          isPrimaryAdmin: false,
          invitedByUserId: invite.createdByUserId,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        })
        .returning();
      if (!member) return { ok: false as const, code: "member_create_failed" };

      await tx
        .update(userInvitation)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          acceptedUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(userInvitation.id, invite.id));

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: invite.targetLegalEntityId,
        eventType: "legal_entity.member_accepted",
        payload: {
          member_user_id: userId,
          role: member.role,
          via: "invitation_token",
        },
        actorUserId: userId,
        actingLegalEntityId: invite.targetLegalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });

      return {
        ok: true as const,
        legalEntityId: invite.targetLegalEntityId,
        member: rowToMember(member),
        inviterUserId: invite.createdByUserId,
      };
    });

    if (!txResult.ok) {
      return txResult;
    }

    const [inviter] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, txResult.inviterUserId))
      .limit(1);
    const [memberUser] = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const [org] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, txResult.legalEntityId))
      .limit(1);

    if (inviter?.email) {
      await this.membershipInviteNotifier.notify({
        kind: "invite_accepted",
        to: inviter.email,
        orgName: org?.displayName ?? "Organisation",
        memberName: memberUser?.name ?? emailNorm,
      });
    }

    return {
      ok: true,
      kind: "accepted",
      legalEntityId: txResult.legalEntityId,
      member: txResult.member,
    };
  }

  async acceptById(
    userId: string,
    userEmail: string,
    invitationId: string,
  ): Promise<InvitationOutcome> {
    const emailNorm = normEmail(userEmail);

    const txResult = await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(userInvitation)
        .where(eq(userInvitation.id, invitationId))
        .limit(1);
      const invite = rows[0];
      if (!invite) return { ok: false as const, code: "invitation_not_found" };
      if (invite.status !== "pending") {
        return { ok: false as const, code: "invitation_not_pending" };
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        return { ok: false as const, code: "invitation_expired" };
      }
      if (!invite.targetLegalEntityId || !invite.targetLegalEntityMemberRole) {
        return { ok: false as const, code: "invitation_not_entity_scoped" };
      }
      if (normEmail(invite.email) !== emailNorm) {
        return { ok: false as const, code: "invitation_email_mismatch" };
      }

      const [member] = await tx
        .insert(legalEntityMember)
        .values({
          legalEntityId: invite.targetLegalEntityId,
          userId,
          role: invite.targetLegalEntityMemberRole as LegalEntityMemberRole,
          isPrimaryAdmin: false,
          invitedByUserId: invite.createdByUserId,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        })
        .returning();
      if (!member) return { ok: false as const, code: "member_create_failed" };

      await tx
        .update(userInvitation)
        .set({
          status: "accepted",
          acceptedAt: new Date(),
          acceptedUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(userInvitation.id, invite.id));

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: invite.targetLegalEntityId,
        eventType: "legal_entity.member_accepted",
        payload: {
          member_user_id: userId,
          role: member.role,
          via: "invitation_id",
        },
        actorUserId: userId,
        actingLegalEntityId: invite.targetLegalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });

      return {
        ok: true as const,
        legalEntityId: invite.targetLegalEntityId,
        member: rowToMember(member),
        inviterUserId: invite.createdByUserId,
      };
    });

    if (!txResult.ok) {
      return txResult;
    }

    const [inviter] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, txResult.inviterUserId))
      .limit(1);
    const [memberUser] = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const [org] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, txResult.legalEntityId))
      .limit(1);

    if (inviter?.email) {
      await this.membershipInviteNotifier.notify({
        kind: "invite_accepted",
        to: inviter.email,
        orgName: org?.displayName ?? "Organisation",
        memberName: memberUser?.name ?? emailNorm,
      });
    }

    return {
      ok: true,
      kind: "accepted",
      legalEntityId: txResult.legalEntityId,
      member: txResult.member,
    };
  }

  async decline(
    userId: string,
    userEmail: string,
    invitationId: string,
    reason?: string | null,
  ): Promise<InvitationOutcome> {
    const emailNorm = normEmail(userEmail);

    const rows = await this.db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.id, invitationId))
      .limit(1);
    const invite = rows[0];
    if (!invite) return { ok: false, code: "invitation_not_found" };
    if (invite.status !== "pending") {
      return { ok: false, code: "invitation_not_pending" };
    }
    if (invite.expiresAt.getTime() < Date.now()) {
      return { ok: false, code: "invitation_expired" };
    }
    if (!invite.targetLegalEntityId) {
      return { ok: false, code: "invitation_not_entity_scoped" };
    }
    if (normEmail(invite.email) !== emailNorm) {
      return { ok: false, code: "invitation_email_mismatch" };
    }

    const legalEntityId = invite.targetLegalEntityId;

    await this.db.transaction(async (tx) => {
      await tx
        .update(userInvitation)
        .set({
          status: "revoked",
          updatedAt: new Date(),
        })
        .where(eq(userInvitation.id, invitationId));

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_declined",
        payload: {
          invitation_id: invitationId,
          invitee_user_id: userId,
          invitee_email: invite.email,
          reason: reason ?? null,
        },
        actorUserId: userId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    });

    const [inviter] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, invite.createdByUserId))
      .limit(1);
    const [org] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);

    if (inviter?.email) {
      await this.membershipInviteNotifier.notify({
        kind: "invite_declined",
        to: inviter.email,
        orgName: org?.displayName ?? "Organisation",
        inviteeEmail: invite.email,
        reason: reason ?? null,
      });
    }

    return { ok: true, kind: "declined" };
  }
}
