import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

const COMPLIANCE_STAFF_ROLES = ["compliance_officer", "super_admin"] as const;

export class DrizzleComplianceRecipientReader implements IComplianceRecipientReader {
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
      .where(
        and(
          eq(bidUserProfile.role, "staff"),
          isNull(bidUserProfile.suspendedAt),
          inArray(bidUserProfile.staffRole, [...COMPLIANCE_STAFF_ROLES]),
        ),
      );
  }
}
