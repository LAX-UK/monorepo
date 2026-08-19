import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";

export class DrizzleStaffOpsRecipientReader implements IStaffOpsRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients() {
    return this.db
      .select({
        id: user.id,
        email: user.email,
        firstName: sql<string | null>`coalesce(${bidUserProfile.firstName}, ${user.name})`,
      })
      .from(user)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(and(eq(bidUserProfile.role, "staff"), isNull(bidUserProfile.suspendedAt)));
  }
}
