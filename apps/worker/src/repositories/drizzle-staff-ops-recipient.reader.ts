import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, staffRoleAssignment } from "@auction/db/schema";
import { staffRoleAssignmentInForceAt } from "@auction/persistence/lib";
import {
  type CapabilityRequirement,
  requirementCapabilities,
  staffRolesGranting,
} from "@auction/types";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { IStaffOpsRecipientReader } from "../interfaces/staff-ops-recipient.reader.js";

export class DrizzleStaffOpsRecipientReader implements IStaffOpsRecipientReader {
  constructor(private readonly db: Database) {}

  async listRecipients(requirement?: CapabilityRequirement) {
    const columns = {
      id: bidIdentityDirectory.subjectId,
      email: bidIdentityDirectory.email,
      firstName: sql<
        string | null
      >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
    };
    const active = and(eq(bidUserProfile.role, "staff"), isNull(bidUserProfile.suspendedAt));

    if (!requirement) {
      return this.db
        .select(columns)
        .from(bidIdentityDirectory)
        .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
        .where(active);
    }

    const roles = staffRolesGranting(requirementCapabilities(requirement));
    return this.db
      .selectDistinct(columns)
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .innerJoin(staffRoleAssignment, eq(staffRoleAssignment.userId, bidUserProfile.userId))
      .where(
        and(
          active,
          inArray(staffRoleAssignment.role, [...roles]),
          staffRoleAssignmentInForceAt(new Date()),
        ),
      );
  }
}
