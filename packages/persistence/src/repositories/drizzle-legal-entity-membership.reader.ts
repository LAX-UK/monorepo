import type { Database } from "@auction/db";
import { bidIdentityDirectory, legalEntity, legalEntityMember } from "@auction/db/schema";
import type { LegalEntitySummary } from "@auction/types";
import { and, eq, inArray, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import type { ILegalEntityMembershipReader } from "../interfaces/legal-entity.reader.js";
import type { ActiveMembership } from "../interfaces/legal-entity.repository.js";

export class DrizzleLegalEntityMembershipReader implements ILegalEntityMembershipReader {
  constructor(private readonly db: Database) {}

  async listActiveMembershipsForUser(userId: string): Promise<LegalEntitySummary[]> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        subkind: legalEntity.subkind,
        status: legalEntity.status,
        statusReason: legalEntity.statusReason,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .where(
        and(
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          notInArray(legalEntity.status, ["archived"]),
        ),
      );
    return rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      kind: r.kind,
      subkind: r.subkind,
      status: r.status,
      statusReason: r.statusReason ?? null,
      role: r.role,
      isPrimaryAdmin: r.isPrimaryAdmin,
    }));
  }

  async findActiveMembership(
    userId: string,
    legalEntityId: string,
  ): Promise<ActiveMembership | null> {
    const rows = await this.db
      .select({
        legalEntityId: legalEntityMember.legalEntityId,
        userId: legalEntityMember.userId,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntityMember)
      .innerJoin(legalEntity, eq(legalEntity.id, legalEntityMember.legalEntityId))
      .where(
        and(
          eq(legalEntityMember.userId, userId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          notInArray(legalEntity.status, ["archived"]),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async listImpersonationNoticeRecipientEmails(
    legalEntityId: string,
  ): Promise<{ email: string; userId: string }[]> {
    const rows = await this.db
      .selectDistinct({
        email: bidIdentityDirectory.email,
        userId: bidIdentityDirectory.subjectId,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );
    return rows;
  }

  async ensurePersonalEntity(userId: string): Promise<LegalEntitySummary> {
    const rows = await this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        kind: legalEntity.kind,
        subkind: legalEntity.subkind,
        status: legalEntity.status,
        role: legalEntityMember.role,
        isPrimaryAdmin: legalEntityMember.isPrimaryAdmin,
      })
      .from(legalEntity)
      .innerJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, legalEntity.id),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .where(and(eq(legalEntity.kind, "individual"), eq(legalEntity.createdByUserId, userId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new Error(
        `personal_entity_missing: user ${userId} has no individual legal entity (0027 backfill missing?)`,
      );
    }
    return row;
  }
}
