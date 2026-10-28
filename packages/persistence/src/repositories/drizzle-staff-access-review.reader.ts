import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile, staffRoleAssignment } from "@auction/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import type {
  IStaffAccessReviewReader,
  StaffAccessReviewPerson,
} from "../interfaces/staff-access-review.reader.js";
import type { StaffRoleAssignmentRecord } from "../interfaces/staff-role-assignment.repository.js";
import { activeIdentitySubject } from "../lib/bid-identity-directory-query.js";
import { staffRoleAssignmentNotEndedAt } from "../lib/staff-role-assignment-sql.js";
import { toStaffRoleAssignmentRecord } from "./drizzle-staff-roster.js";

/** The access review's people and their roles, from the identity directory and the roster. */
export class DrizzleStaffAccessReviewReader implements IStaffAccessReviewReader {
  constructor(private readonly db: Database) {}

  async listStaff(now: Date): Promise<StaffAccessReviewPerson[]> {
    const people = await this.db
      .select({
        userId: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        email: bidIdentityDirectory.email,
        suspendedAt: bidUserProfile.suspendedAt,
      })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(and(activeIdentitySubject(), eq(bidUserProfile.role, "staff")))
      .orderBy(asc(bidIdentityDirectory.name), asc(bidIdentityDirectory.email));
    if (people.length === 0) return [];

    const rows = await this.db
      .select()
      .from(staffRoleAssignment)
      .where(
        and(
          inArray(
            staffRoleAssignment.userId,
            people.map((person) => person.userId),
          ),
          staffRoleAssignmentNotEndedAt(now),
        ),
      )
      .orderBy(asc(staffRoleAssignment.startsAt));
    const byPerson = new Map<string, StaffRoleAssignmentRecord[]>();
    for (const row of rows) {
      const list = byPerson.get(row.userId) ?? [];
      list.push(toStaffRoleAssignmentRecord(row));
      byPerson.set(row.userId, list);
    }

    return people.map((person) => ({
      userId: person.userId,
      name: person.name,
      email: person.email,
      suspended: person.suspendedAt !== null,
      assignments: byPerson.get(person.userId) ?? [],
    }));
  }
}
