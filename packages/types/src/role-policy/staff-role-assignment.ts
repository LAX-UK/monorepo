import type { UserStaffRole } from "../user.js";
import { type StaffRoles, normalizeStaffRoles } from "./staff-roles.js";

/**
 * One role held by one person for a period. An open end means until someone removes it. `R` is
 * the admin's role set: Bid's by default, LAX Admin's for its own assignments.
 */
export type StaffRoleAssignment<R extends string = UserStaffRole> = {
  readonly role: R;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
};

type Period = Pick<StaffRoleAssignment<string>, "startsAt" | "endsAt">;

/** In force at `now`: started, and not yet ended. */
export function isStaffRoleAssignmentActive(assignment: Period, now: Date): boolean {
  const t = now.getTime();
  return (
    assignment.startsAt.getTime() <= t &&
    (assignment.endsAt === null || assignment.endsAt.getTime() > t)
  );
}

/** Not ended at `now`: in force, or starting later. */
export function isStaffRoleAssignmentCurrent(
  assignment: Pick<Period, "endsAt">,
  now: Date,
): boolean {
  return assignment.endsAt === null || assignment.endsAt.getTime() > now.getTime();
}

/** The roles in force at `now`, each once and in first-held order. Any admin's role set. */
export function activeRolesOf<R extends string>(
  assignments: readonly StaffRoleAssignment<R>[],
  now: Date,
): R[] {
  return [
    ...new Set(assignments.filter((a) => isStaffRoleAssignmentActive(a, now)).map((a) => a.role)),
  ];
}

/** The Bid roles in force at `now`, each once. */
export function activeStaffRoles(
  assignments: readonly StaffRoleAssignment[],
  now: Date,
): StaffRoles {
  return normalizeStaffRoles(activeRolesOf(assignments, now));
}

/** Whether two periods share any instant. Open ends run forever. */
export function staffRoleAssignmentsOverlap(a: Period, b: Period): boolean {
  const aEnd = a.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bEnd = b.endsAt?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.startsAt.getTime() < bEnd && b.startsAt.getTime() < aEnd;
}

const DAY_MS = 86_400_000;

/** Has an end date within the next `days` days of `now` (and has not ended yet). */
export function staffRoleAssignmentEndsWithin(
  assignment: Pick<Period, "endsAt">,
  now: Date,
  days: number,
): boolean {
  if (assignment.endsAt === null) return false;
  const end = assignment.endsAt.getTime();
  const t = now.getTime();
  return end > t && end <= t + days * DAY_MS;
}
