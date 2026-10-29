import type { UserStaffRole } from "../user.js";
import type { StaffRoleAssignment } from "./staff-role-assignment.js";
import {
  type ForbiddenStaffRoleCombination as AnyForbiddenStaffRoleCombination,
  type StaffRoleAssignmentCheck as AnyStaffRoleAssignmentCheck,
  type StaffRoleChange as AnyStaffRoleChange,
  type StaffRoleSetCheck as AnyStaffRoleSetCheck,
  type StaffRosterFacts,
  createStaffRoleRules,
} from "./staff-role-rule-engine.js";

export type { StaffRoleAssignmentRefusal, StaffRosterFacts } from "./staff-role-rule-engine.js";

/** The role that holds every permission; Bid must always keep at least one active holder. */
export const ADMINISTRATOR_STAFF_ROLE: UserStaffRole = "administrator";

export type ForbiddenStaffRoleCombination = AnyForbiddenStaffRoleCombination<UserStaffRole>;
export type StaffRoleChange = AnyStaffRoleChange<UserStaffRole>;
export type StaffRoleAssignmentCheck = AnyStaffRoleAssignmentCheck<UserStaffRole>;
export type StaffRoleSetCheck = AnyStaffRoleSetCheck<UserStaffRole>;

/**
 * Roles one person may not hold at the same time in Bid admin. Each rule reads both ways. Add a
 * rule here rather than checking roles at call sites.
 */
export const FORBIDDEN_STAFF_ROLE_COMBINATIONS: readonly ForbiddenStaffRoleCombination[] = [
  {
    role: "administrator",
    with: "any",
    why: "The administrator role already holds every permission.",
  },
  {
    role: "read_only",
    with: "any",
    why: "Read-only access stays read-only; any other role would widen it.",
  },
  {
    role: "finance",
    with: ["compliance"],
    why: "Moving money and clearing compliance checks are kept with different people.",
  },
];

/** Bid admin's role rules, from the shared engine. */
export const BID_STAFF_ROLE_RULES = createStaffRoleRules<UserStaffRole>({
  administratorRole: ADMINISTRATOR_STAFF_ROLE,
  forbidden: FORBIDDEN_STAFF_ROLE_COMBINATIONS,
});

/** The rule that keeps `a` and `b` apart, or null when one person may hold both. */
export function forbiddenStaffRoleCombination(
  a: UserStaffRole,
  b: UserStaffRole,
): ForbiddenStaffRoleCombination | null {
  return BID_STAFF_ROLE_RULES.forbiddenCombination(a, b);
}

/** Whether one person may not hold `a` and `b` at the same time. */
export function isForbiddenStaffRoleCombination(a: UserStaffRole, b: UserStaffRole): boolean {
  return BID_STAFF_ROLE_RULES.isForbiddenCombination(a, b);
}

/**
 * Whether a person whose Bid assignments are `current` may take the `requested` change at `now`:
 * no role twice in the same period, no forbidden combination in an overlapping period, and never
 * the removal of the last active administrator.
 */
export function checkStaffRoleAssignment(
  current: readonly StaffRoleAssignment[],
  requested: StaffRoleChange,
  now: Date,
  roster: StaffRosterFacts,
): StaffRoleAssignmentCheck {
  return BID_STAFF_ROLE_RULES.check(current, requested, now, roster);
}

/** Whether one person may be given every Bid role in `roles` at once, as an invitation does. */
export function checkStaffRoleSet(roles: readonly UserStaffRole[]): StaffRoleSetCheck {
  return BID_STAFF_ROLE_RULES.checkSet(roles);
}
