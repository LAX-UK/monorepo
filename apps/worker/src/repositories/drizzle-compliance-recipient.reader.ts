import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

const COMPLIANCE_STAFF_ROLES = ["compliance_officer", "super_admin"] as const;

export class DrizzleComplianceRecipientReader implements IComplianceRecipientReader {
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
      .where(
        and(
          eq(bidUserProfile.role, "staff"),
          isNull(bidUserProfile.suspendedAt),
          inArray(bidUserProfile.staffRole, [...COMPLIANCE_STAFF_ROLES]),
        ),
      );
  }
}
