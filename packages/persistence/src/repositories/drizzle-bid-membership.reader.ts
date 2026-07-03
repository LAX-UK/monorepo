import type { Database } from "@auction/db";
import { legalEntityMember } from "@auction/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { IBidMembershipReader } from "../interfaces/bid-membership.reader.js";

export class DrizzleBidMembershipReader implements IBidMembershipReader {
  constructor(private readonly db: Database) {}

  async findActiveMemberRole(userId: string, legalEntityId: string) {
    const [row] = await this.db
      .select({ role: legalEntityMember.role })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);
    return row?.role ?? null;
  }
}
