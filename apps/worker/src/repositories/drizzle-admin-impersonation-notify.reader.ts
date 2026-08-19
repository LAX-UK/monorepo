import type { Database } from "@auction/db";
import { bidUserProfile, legalEntityMember, user } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { IAdminImpersonationNotifyReader } from "../interfaces/admin-impersonation-notify.reader.js";

export class DrizzleAdminImpersonationNotifyReader implements IAdminImpersonationNotifyReader {
  constructor(private readonly db: Database) {}

  async getAdminDisplayName(userId: string): Promise<string> {
    const [row] = await this.db
      .select({
        name: user.name,
        firstName: bidUserProfile.firstName,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    return row?.firstName?.trim() || row?.name?.trim() || "LAX support";
  }

  async listEntityOwnerAdmins(legalEntityId: string) {
    return this.db
      .selectDistinct({
        email: user.email,
        userId: user.id,
        firstName: sql<string | null>`coalesce(${bidUserProfile.firstName}, ${user.name})`,
      })
      .from(legalEntityMember)
      .innerJoin(user, eq(user.id, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
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
  }
}
