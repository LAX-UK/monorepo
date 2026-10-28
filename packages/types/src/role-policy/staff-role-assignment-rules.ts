import type { UserStaffRole } from "../user.js";
import {
  type StaffRoleAssignment,
  isStaffRoleAssignmentActive,
  isStaffRoleAssignmentCurrent,
  staffRoleAssignmentsOverlap,
} from "./staff-role-assignment.js";

/** The role that holds every permission; Bid must always keep at least one active holder. */
export const ADMINISTRATOR_STAFF_ROLE: UserStaffRole = "administrator";

export type ForbiddenStaffRoleCombination = {
  readonly role: UserStaffRole;
  /** Roles it may not be held together with; `"any"` means it is only ever held alone. */
  readonly with: readonly UserStaffRole[] | "any";
  readonly why: string;
};

/**
 * Roles one person may not hold at the same time. Each rule reads both ways. Add a rule here
 * rather than checking roles at call sites.
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

function ruleForbids(rule: ForbiddenStaffRoleCombination, a: UserStaffRole, b: UserStaffRole) {
  return rule.role === a && (rule.with === "any" || rule.with.includes(b));
}

/** Whether one person may not hold `a` and `b` at the same time. */
export function isForbiddenStaffRoleCombination(a: UserStaffRole, b: UserStaffRole): boolean {
  if (a === b) return false;
  return FORBIDDEN_STAFF_ROLE_COMBINATIONS.some(
    (rule) => ruleForbids(rule, a, b) || ruleForbids(rule, b, a),
  );
}

export type StaffRoleChange =
  | {
      readonly kind: "assign";
      readonly role: UserStaffRole;
      readonly startsAt: Date;
      readonly endsAt: Date | null;
    }
  | { readonly kind: "remove"; readonly role: UserStaffRole };

/** Facts about everyone else on the roster that a single person's change depends on. */
export type StaffRosterFacts = {
  /** People other than this one who hold the administrator role right now. */
  readonly otherActiveAdministrators: number;
};

export type StaffRoleAssignmentRefusal =
  | "duplicate"
  | "forbidden_combination"
  | "last_administrator"
  | "not_assigned"
  | "invalid_period";

export type StaffRoleAssignmentCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: StaffRoleAssignmentRefusal;
      /** The role already held that the requested one cannot be combined with. */
      readonly conflictingRole?: UserStaffRole;
    };

const OK: StaffRoleAssignmentCheck = { ok: true };

function checkAssign(
  current: readonly StaffRoleAssignment[],
  requested: Extract<StaffRoleChange, { kind: "assign" }>,
  now: Date,
): StaffRoleAssignmentCheck {
  if (
    requested.endsAt !== null &&
    (requested.endsAt.getTime() <= requested.startsAt.getTime() ||
      requested.endsAt.getTime() <= now.getTime())
  ) {
    return { ok: false, reason: "invalid_period" };
  }
  const overlapping = current.filter(
    (held) =>
      isStaffRoleAssignmentCurrent(held, now) && staffRoleAssignmentsOverlap(held, requested),
  );
  if (overlapping.some((held) => held.role === requested.role)) {
    return { ok: false, reason: "duplicate" };
  }
  const conflict = overlapping.find((held) =>
    isForbiddenStaffRoleCombination(held.role, requested.role),
  );
  if (conflict) {
    return { ok: false, reason: "forbidden_combination", conflictingRole: conflict.role };
  }
  return OK;
}

function checkRemove(
  current: readonly StaffRoleAssignment[],
  requested: Extract<StaffRoleChange, { kind: "remove" }>,
  now: Date,
  roster: StaffRosterFacts,
): StaffRoleAssignmentCheck {
  const held = current.filter(
    (a) => a.role === requested.role && isStaffRoleAssignmentCurrent(a, now),
  );
  if (held.length === 0) return { ok: false, reason: "not_assigned" };
  const removesActiveAdministrator =
    requested.role === ADMINISTRATOR_STAFF_ROLE &&
    held.some((a) => isStaffRoleAssignmentActive(a, now));
  if (removesActiveAdministrator && roster.otherActiveAdministrators === 0) {
    return { ok: false, reason: "last_administrator" };
  }
  return OK;
}

/**
 * Whether a person whose assignments are `current` may take the `requested` change at `now`:
 * no role twice in the same period, no forbidden combination in an overlapping period, and never
 * the removal of the last active administrator.
 */
export function checkStaffRoleAssignment(
  current: readonly StaffRoleAssignment[],
  requested: StaffRoleChange,
  now: Date,
  roster: StaffRosterFacts,
): StaffRoleAssignmentCheck {
  return requested.kind === "assign"
    ? checkAssign(current, requested, now)
    : checkRemove(current, requested, now, roster);
}
