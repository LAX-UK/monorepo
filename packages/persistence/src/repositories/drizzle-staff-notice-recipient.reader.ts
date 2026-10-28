import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, staffRoleAssignment } from "@auction/db/schema";
import { ADMINISTRATOR_STAFF_ROLE } from "@auction/types";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  IStaffNoticeRecipientReader,
  StaffNoticeRecipient,
} from "../interfaces/staff-notice-recipient.reader.js";
import { staffRoleAssignmentInForceAt } from "../lib/staff-role-assignment-sql.js";

const recipientColumns = {
  id: bidIdentityDirectory.subjectId,
  email: bidIdentityDirectory.email,
  name: bidIdentityDirectory.name,
  firstName: sql<
    string | null
  >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
};

/** Recipients of staff notices, read from the identity directory and the Bid profile. */
export class DrizzleStaffNoticeRecipientReader implements IStaffNoticeRecipientReader {
  constructor(private readonly db: Database) {}

  async findByIds(ids: readonly string[]): Promise<StaffNoticeRecipient[]> {
    if (ids.length === 0) return [];
    return this.db
      .select(recipientColumns)
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(inArray(bidIdentityDirectory.subjectId, [...new Set(ids)]));
  }

  async listActiveAdministrators(now: Date): Promise<StaffNoticeRecipient[]> {
    return this.db
      .selectDistinct(recipientColumns)
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .innerJoin(staffRoleAssignment, eq(staffRoleAssignment.userId, bidUserProfile.userId))
      .where(
        and(
          eq(bidUserProfile.role, "staff"),
          isNull(bidUserProfile.suspendedAt),
          eq(staffRoleAssignment.role, ADMINISTRATOR_STAFF_ROLE),
          staffRoleAssignmentInForceAt(now),
        ),
      );
  }
}
