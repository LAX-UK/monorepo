import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, staffRoleAssignment } from "@auction/db/schema";
import { staffRoleAssignmentInForceAt } from "@auction/persistence/repositories";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { IComplianceRecipientReader } from "../interfaces/compliance-recipient.reader.js";

const COMPLIANCE_STAFF_ROLES = ["compliance_officer", "super_admin"] as const;

/** Active staff who hold a compliance role right now, each once. */
export class DrizzleComplianceRecipientReader implements IComplianceRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients() {
    return this.db
      .selectDistinct({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .innerJoin(staffRoleAssignment, eq(staffRoleAssignment.userId, bidUserProfile.userId))
      .where(
        and(
          eq(bidUserProfile.role, "staff"),
          isNull(bidUserProfile.suspendedAt),
          inArray(staffRoleAssignment.role, [...COMPLIANCE_STAFF_ROLES]),
          staffRoleAssignmentInForceAt(new Date()),
        ),
      );
  }
}
