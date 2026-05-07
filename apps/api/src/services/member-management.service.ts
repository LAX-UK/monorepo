import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "@auction/db";
import { legalEntityMember, user, userInvitation } from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityMemberRole } from "@auction/types";
import { and, desc, eq, isNull } from "drizzle-orm";
import { DrizzleBidRepository } from "../repositories/drizzle-bid.repository.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import {
  type AcceptInviteResult,
  type IMemberManagementService,
  type InviteMemberInput,
  MemberPermissionError,
  type MemberWithUser,
  type UpdateMemberRoleInput,
} from "./interfaces/member-management.js";

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

export class MemberManagementService implements IMemberManagementService {
  constructor(
    private readonly db: Database,
    private readonly domainEventPublisher: DomainEventPublisher,
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

  async listMembers(legalEntityId: string): Promise<MemberWithUser[]> {
    const rows = await this.db
      .select({
        member: legalEntityMember,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        },
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .orderBy(desc(legalEntityMember.isPrimaryAdmin), legalEntityMember.createdAt);
    return rows.map((r) => ({
      ...rowToMember(r.member),
      user: { ...r.user, image: r.user.image ?? null },
    }));
  }

  async inviteMember(actingUserId: string, legalEntityId: string, input: InviteMemberInput) {
    await this.assertActorIsAdmin(actingUserId, legalEntityId);
    const email = input.email.trim().toLowerCase();

    return await this.db.transaction(async (tx) => {
      const existingUserRows = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, email))
        .limit(1);
      const existingUser = existingUserRows[0];

      if (existingUser) {
        // Check for an active membership already.
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

        const [created] = await tx
          .insert(legalEntityMember)
          .values({
            legalEntityId,
            userId: existingUser.id,
            role: input.role,
            isPrimaryAdmin: false,
            invitedByUserId: actingUserId,
            invitedAt: new Date(),
            // Existing users skip the email round-trip and get added as
            // accepted immediately. The dashboard surfaces the new entity in
            // their switcher.
            acceptedAt: new Date(),
          })
          .returning({ id: legalEntityMember.id });
        await this.domainEventPublisher.publish(tx, {
          aggregateType: "legal_entity",
          aggregateId: legalEntityId,
          eventType: "legal_entity.member_accepted",
          payload: {
            member_user_id: existingUser.id,
            role: input.role,
            via: "direct_add_existing_user",
          },
          actorUserId: actingUserId,
          actingLegalEntityId: legalEntityId,
          schemaVersion: 1,
          producer: "apps/api",
        });
        return {
          memberId: created?.id ?? null,
          invitationToken: null,
        };
      }

      // No existing user: create an entity-scoped invitation.
      const id = randomUUID();
      const token = randomBytes(32).toString("base64url");
      const tokenHash = hashToken(token);
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
      return { memberId: null, invitationToken: token };
    });
  }

  async acceptInvite(userId: string, token: string): Promise<AcceptInviteResult> {
    const tokenHash = hashToken(token);
    return await this.db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(userInvitation)
        .where(eq(userInvitation.tokenHash, tokenHash))
        .limit(1);
      const invite = rows[0];
      if (!invite) throw new MemberPermissionError("invitation_not_found");
      if (invite.status !== "pending") {
        throw new MemberPermissionError("invitation_not_pending");
      }
      if (invite.expiresAt.getTime() < Date.now()) {
        throw new MemberPermissionError("invitation_expired");
      }
      if (!invite.targetLegalEntityId || !invite.targetLegalEntityMemberRole) {
        throw new MemberPermissionError("invitation_not_entity_scoped");
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
      if (!member) throw new MemberPermissionError("member_create_failed");

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

      return { legalEntityId: invite.targetLegalEntityId, member: rowToMember(member) };
    });
  }

  async updateRole(
    actingUserId: string,
    legalEntityId: string,
    memberId: string,
    input: UpdateMemberRoleInput,
  ): Promise<LegalEntityMember> {
    await this.assertActorIsAdmin(actingUserId, legalEntityId);
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(eq(legalEntityMember.id, memberId))
      .limit(1);
    const target = rows[0];
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("member_not_found");
    }
    if (target.isPrimaryAdmin && input.role !== "owner") {
      throw new MemberPermissionError("cannot_demote_primary_admin");
    }
    const prevRole = target.role;
    const [updated] = await this.db
      .update(legalEntityMember)
      .set({ role: input.role })
      .where(eq(legalEntityMember.id, memberId))
      .returning();
    if (!updated) throw new MemberPermissionError("member_update_failed");
    if (prevRole !== input.role) {
      await this.domainEventPublisher.publish(this.db, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_role_changed",
        payload: {
          member_user_id: target.userId,
          member_id: memberId,
          from_role: prevRole,
          to_role: input.role,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    }
    return rowToMember(updated);
  }

  async removeMember(actingUserId: string, legalEntityId: string, memberId: string): Promise<void> {
    await this.assertActorIsAdmin(actingUserId, legalEntityId);
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(eq(legalEntityMember.id, memberId))
      .limit(1);
    const target = rows[0];
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("member_not_found");
    }
    if (target.isPrimaryAdmin) {
      throw new MemberPermissionError("cannot_remove_primary_admin");
    }

    await this.db.transaction(async (tx) => {
      const bids = new DrizzleBidRepository(tx);
      const pairs = await bids.listActiveProxyBidPairsForMemberOnEntity(
        target.userId,
        legalEntityId,
      );
      for (const { lotId, bidderId } of pairs) {
        const cleared = await bids.clearProxyAutoBidForBidderOnLot(lotId, bidderId);
        if (cleared > 0) {
          await this.domainEventPublisher.publish(tx, {
            aggregateType: "lot",
            aggregateId: lotId,
            eventType: "bid.proxy_cancelled",
            payload: {
              lotId,
              bidderUserId: bidderId,
              buyerLegalEntityId: legalEntityId,
              reason: "member_removed",
            },
            actorUserId: actingUserId,
            actingLegalEntityId: legalEntityId,
            schemaVersion: 1,
            producer: "apps/api",
          });
        }
      }

      await tx
        .update(legalEntityMember)
        .set({ removedAt: new Date() })
        .where(eq(legalEntityMember.id, memberId));

      await this.domainEventPublisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: legalEntityId,
        eventType: "legal_entity.member_removed",
        payload: {
          member_user_id: target.userId,
          removed_by_user_id: actingUserId,
          role_at_removal: target.role,
          reason: null,
        },
        actorUserId: actingUserId,
        actingLegalEntityId: legalEntityId,
        schemaVersion: 1,
        producer: "apps/api",
      });
    });
  }

  async transferPrimaryAdmin(actingUserId: string, legalEntityId: string, toMemberId: string) {
    const me = await this.assertActorIsAdmin(actingUserId, legalEntityId);
    if (!me.isPrimaryAdmin) {
      throw new MemberPermissionError("only_primary_admin_can_transfer");
    }
    const rows = await this.db
      .select()
      .from(legalEntityMember)
      .where(eq(legalEntityMember.id, toMemberId))
      .limit(1);
    const target = rows[0];
    if (!target || target.legalEntityId !== legalEntityId || target.removedAt) {
      throw new MemberPermissionError("target_member_not_found");
    }
    if (target.id === me.id) {
      throw new MemberPermissionError("cannot_transfer_to_self");
    }

    return await this.db.transaction(async (tx) => {
      // Demote current primary first; the partial unique index requires the
      // old row's `isPrimaryAdmin = false` before we can flip the new row to
      // true.
      const [from] = await tx
        .update(legalEntityMember)
        .set({ isPrimaryAdmin: false, role: "admin" })
        .where(eq(legalEntityMember.id, me.id))
        .returning();
      if (!from) throw new MemberPermissionError("transfer_demote_failed");

      const [to] = await tx
        .update(legalEntityMember)
        .set({ isPrimaryAdmin: true, role: "owner" })
        .where(eq(legalEntityMember.id, toMemberId))
        .returning();
      if (!to) throw new MemberPermissionError("transfer_promote_failed");

      return { from: rowToMember(from), to: rowToMember(to) };
    });
  }
}
