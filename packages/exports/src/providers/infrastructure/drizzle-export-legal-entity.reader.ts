import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember } from "@auction/db/schema";
import { and, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import type { ActiveMembership, ILegalEntityRepository } from "../ports/legal-entity-repository.js";

export class DrizzleExportLegalEntityReader
  implements Pick<ILegalEntityRepository, "findActiveMembership">
{
  constructor(private readonly db: Database) {}

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
}
