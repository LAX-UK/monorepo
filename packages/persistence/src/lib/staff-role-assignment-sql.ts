import { staffRoleAssignment } from "@auction/db/schema";
import { type AnyColumn, type SQL, and, gt, isNull, lte, or, sql } from "drizzle-orm";

/** Not ended at `at`: open-ended, or ending later. */
export function staffRoleAssignmentNotEndedAt(at: Date | SQL) {
  return or(isNull(staffRoleAssignment.endsAt), gt(staffRoleAssignment.endsAt, at));
}

/**
 * SQL form of `isStaffRoleAssignmentActive`, for queries over many people (recipient lists, the
 * administrator count, staff lists). Single-person reads load rows and let the domain decide.
 * Pass `sql\`now()\`` where the moment is the query's own.
 */
export function staffRoleAssignmentInForceAt(at: Date | SQL) {
  return and(lte(staffRoleAssignment.startsAt, at), staffRoleAssignmentNotEndedAt(at));
}

/** The roles in force now for the person in `userId`, as a sorted text array (empty if none). */
export function staffRolesInForceFor(userId: AnyColumn): SQL<string[]> {
  return sql<string[]>`coalesce((
    select array_agg(${staffRoleAssignment.role}::text order by ${staffRoleAssignment.role})
    from ${staffRoleAssignment}
    where ${staffRoleAssignment.userId} = ${userId}
      and ${staffRoleAssignmentInForceAt(sql`now()`)}
  ), '{}'::text[])`;
}

/** Whether the person in `userId` holds `role` in force now. For filters and counts over people. */
export function holdsStaffRoleNow(userId: AnyColumn, role: string): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${staffRoleAssignment}
    where ${staffRoleAssignment.userId} = ${userId}
      and ${staffRoleAssignment.role}::text = ${role}
      and ${staffRoleAssignmentInForceAt(sql`now()`)}
  )`;
}
