import type { Database } from "@auction/db";
import { legalEntity, legalEntityMember, user } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { ILegalEntityArchiveCascadeReader } from "../interfaces/legal-entity-archive-cascade.reader.js";

const NOTIFY_ROLES = ["owner", "admin", "finance", "consignor", "buyer_agent"] as const;

export class DrizzleLegalEntityArchiveCascadeReader implements ILegalEntityArchiveCascadeReader {
  constructor(private readonly db: Database) {}

  async getEntityDisplayName(legalEntityId: string): Promise<string> {
    const [row] = await this.db
      .select({ displayName: legalEntity.displayName })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);
    return row?.displayName ?? "Organisation";
  }

  async listNotifyMembers(legalEntityId: string) {
    return this.db
      .selectDistinct({
        email: user.email,
        userId: user.id,
        firstName: user.firstName,
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          inArray(legalEntityMember.role, [...NOTIFY_ROLES]),
        ),
      );
  }
}
