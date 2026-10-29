import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  legalEntity,
  legalEntityMember,
  userInvitation,
} from "@auction/db/schema";
import type { LegalEntityMember, LegalEntityStatus } from "@auction/types";
import { and, desc, eq, isNull } from "drizzle-orm";
import type {
  EntityInvitationCreate,
  EntityMemberCreate,
  EntityPendingInvitation,
  IEntityInvitationRepository,
} from "../interfaces/entity-invitation.repository.js";
import type { InvitationRow } from "../interfaces/invitation.repository.js";
import {
  activeIdentitySubject,
  normalizedIdentityEmailEquals,
} from "../lib/bid-identity-directory-query.js";
import { rowToLegalEntityMember } from "../lib/legal-entity-member.mapper.js";

function mapInvitationRow(row: typeof userInvitation.$inferSelect): InvitationRow {
  return {
    id: row.id,
    email: row.email,
    targetRole: row.targetRole as InvitationRow["targetRole"],
    targetStaffRole: row.targetStaffRole ?? null,
    tokenHash: row.tokenHash,
    status: row.status,
    expiresAt: row.expiresAt,
    openedAt: row.openedAt ?? null,
    lastEmailOutboxId: row.lastEmailOutboxId ?? null,
    acceptedAt: row.acceptedAt ?? null,
    acceptedUserId: row.acceptedUserId ?? null,
    targetLegalEntityId: row.targetLegalEntityId ?? null,
    targetLegalEntityMemberRole: row.targetLegalEntityMemberRole ?? null,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleEntityInvitationRepository implements IEntityInvitationRepository {
  constructor(private readonly db: Database) {}

  forConnection(conn: Database): IEntityInvitationRepository {
    return new DrizzleEntityInvitationRepository(conn);
  }

  async findUserIdByEmail(email: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: bidIdentityDirectory.subjectId })
      .from(bidIdentityDirectory)
      .where(
        and(
          normalizedIdentityEmailEquals(bidIdentityDirectory.email, email),
          activeIdentitySubject(),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async userExistsByEmail(email: string): Promise<boolean> {
    return (await this.findUserIdByEmail(email)) !== null;
  }

  async hasActiveMember(legalEntityId: string, userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: legalEntityMember.id })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async revokePendingForEntity(email: string, legalEntityId: string): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(
        and(
          eq(userInvitation.email, email),
          eq(userInvitation.targetLegalEntityId, legalEntityId),
          eq(userInvitation.status, "pending"),
        ),
      );
  }

  async insertInvitation(row: EntityInvitationCreate): Promise<void> {
    await this.db.insert(userInvitation).values({
      id: row.id,
      email: row.email,
      targetRole: "client",
      tokenHash: row.tokenHash,
      status: "pending",
      expiresAt: row.expiresAt,
      acceptedAt: null,
      acceptedUserId: null,
      targetLegalEntityId: row.legalEntityId,
      targetLegalEntityMemberRole: row.memberRole,
      createdByUserId: row.createdByUserId,
    });
  }

  async findByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.tokenHash, tokenHash))
      .limit(1);
    return row ? mapInvitationRow(row) : null;
  }

  async findById(id: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.id, id))
      .limit(1);
    return row ? mapInvitationRow(row) : null;
  }

  async insertMember(input: EntityMemberCreate): Promise<LegalEntityMember | null> {
    // `legal_entity_member_active_uidx` allows one active row per person and organisation. A
    // concurrent accept that loses the race waits for the winner's commit, then inserts nothing.
    const [member] = await this.db
      .insert(legalEntityMember)
      .values({
        legalEntityId: input.legalEntityId,
        userId: input.userId,
        role: input.role,
        isPrimaryAdmin: false,
        invitedByUserId: input.invitedByUserId,
        invitedAt: input.invitedAt,
        acceptedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [legalEntityMember.legalEntityId, legalEntityMember.userId],
        where: isNull(legalEntityMember.removedAt),
      })
      .returning();
    return member ? rowToLegalEntityMember(member) : null;
  }

  async markInvitationAccepted(id: string, userId: string): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedUserId: userId,
        updatedAt: new Date(),
      })
      .where(eq(userInvitation.id, id));
  }

  async markInvitationRevoked(id: string): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({
        status: "revoked",
        updatedAt: new Date(),
      })
      .where(eq(userInvitation.id, id));
  }

  async listPendingForEntity(legalEntityId: string): Promise<EntityPendingInvitation[]> {
    const rows = await this.db
      .select({
        id: userInvitation.id,
        email: userInvitation.email,
        role: userInvitation.targetLegalEntityMemberRole,
        sentAt: userInvitation.createdAt,
        expiresAt: userInvitation.expiresAt,
      })
      .from(userInvitation)
      .where(
        and(
          eq(userInvitation.targetLegalEntityId, legalEntityId),
          eq(userInvitation.status, "pending"),
        ),
      )
      .orderBy(desc(userInvitation.createdAt));
    return rows.flatMap((row) =>
      row.role ? [{ ...row, role: row.role as EntityPendingInvitation["role"] }] : [],
    );
  }

  async hasPendingForEntity(email: string, legalEntityId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: userInvitation.id })
      .from(userInvitation)
      .where(
        and(
          eq(userInvitation.email, email),
          eq(userInvitation.targetLegalEntityId, legalEntityId),
          eq(userInvitation.status, "pending"),
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  async markInvitationPending(id: string): Promise<boolean> {
    const rows = await this.db
      .update(userInvitation)
      .set({ status: "pending", updatedAt: new Date() })
      .where(and(eq(userInvitation.id, id), eq(userInvitation.status, "revoked")))
      .returning({ id: userInvitation.id });
    return rows.length > 0;
  }

  async findUserName(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row?.name ?? null;
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: bidIdentityDirectory.email })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row?.email ?? null;
  }

  async findLegalEntityDisplayName(legalEntityId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    return row?.displayName ?? null;
  }

  async findLegalEntityStatus(legalEntityId: string): Promise<LegalEntityStatus | null> {
    const [row] = await this.db
      .select({ status: legalEntity.status })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    return row?.status ?? null;
  }
}
