import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, legalEntityMember } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { IAdminImpersonationNotifyReader } from "../interfaces/admin-impersonation-notify.reader.js";

export class DrizzleAdminImpersonationNotifyReader implements IAdminImpersonationNotifyReader {
  constructor(private readonly db: Database) {}

  async getAdminDisplayName(userId: string): Promise<string> {
    const [row] = await this.db
      .select({
        name: bidIdentityDirectory.name,
        firstName: bidUserProfile.firstName,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row?.firstName?.trim() || row?.name?.trim() || "LAX support";
  }

  async listEntityOwnerAdmins(legalEntityId: string) {
    return this.db
      .selectDistinct({
        email: bidIdentityDirectory.email,
        userId: bidIdentityDirectory.subjectId,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
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
