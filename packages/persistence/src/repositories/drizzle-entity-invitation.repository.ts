import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, user, userInvitation } from "@auction/db/schema";
import type { LegalEntityMember } from "@auction/types";
import { and, eq, isNull } from "drizzle-orm";
import type {
  EntityInvitationCreate,
  EntityMemberCreate,
  IEntityInvitationRepository,
} from "../interfaces/entity-invitation.repository.js";
import type { InvitationRow } from "../interfaces/invitation.repository.js";
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
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
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

  async findUserName(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return row?.name ?? null;
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
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
}

/** @deprecated Use DrizzleEntityInvitationRepository — kept for import compatibility. */
export { DrizzleEntityInvitationRepository as DrizzleInvitationRepository };
