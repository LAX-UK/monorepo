import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";

export class DrizzleStaffOpsRecipientReader implements IStaffOpsRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients() {
    return this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(and(eq(bidUserProfile.role, "staff"), isNull(bidUserProfile.suspendedAt)));
  }
}
