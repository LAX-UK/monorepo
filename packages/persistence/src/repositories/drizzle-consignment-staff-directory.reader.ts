import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, staffRoleAssignment } from "@auction/db/schema";
import { normalizeStaffRoles } from "@auction/types";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type {
  ActiveStaffMember,
  IConsignmentStaffDirectory,
} from "../interfaces/consignment-staff-directory.reader.js";
import { staffRoleAssignmentInForceAt } from "../lib/staff-role-assignment-sql.js";

export class DrizzleConsignmentStaffDirectory implements IConsignmentStaffDirectory {
  constructor(private readonly db: Database) {}

  listActiveStaff(now: Date): Promise<ActiveStaffMember[]> {
    return this.read(now);
  }

  async findActiveStaff(userId: string, now: Date): Promise<ActiveStaffMember | null> {
    const [member] = await this.read(now, [userId]);
    return member ?? null;
  }

  private async read(now: Date, userIds?: readonly string[]): Promise<ActiveStaffMember[]> {
    const rows = await this.db
      .select({
        userId: staffRoleAssignment.userId,
        role: staffRoleAssignment.role,
        name: bidIdentityDirectory.name,
      })
      .from(staffRoleAssignment)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, staffRoleAssignment.userId))
      .innerJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, staffRoleAssignment.userId),
      )
      .where(
        and(
          staffRoleAssignmentInForceAt(now),
          eq(bidUserProfile.role, "staff"),
          isNull(bidUserProfile.suspendedAt),
          userIds ? inArray(staffRoleAssignment.userId, [...userIds]) : undefined,
        ),
      );
    const members = new Map<string, { name: string; roles: string[] }>();
    for (const row of rows) {
      const member = members.get(row.userId) ?? { name: row.name, roles: [] };
      member.roles.push(row.role);
      members.set(row.userId, member);
    }
    return [...members.entries()]
      .map(([userId, member]) => ({
        userId,
        name: member.name,
        roles: normalizeStaffRoles(member.roles),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
