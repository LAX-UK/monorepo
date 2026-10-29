import {
  type StaffRoleAssignment,
  isStaffRoleAssignmentActive,
  isStaffRoleAssignmentCurrent,
  staffRoleAssignmentsOverlap,
} from "./staff-role-assignment.js";

/**
 * The role rules every admin shares, run against each admin's own table: no role twice in the
 * same period, no forbidden combination in an overlapping period, never the removal of the last
 * active administrator. Bid and LAX Admin each build one engine from their table, so a new rule
 * is a row in a table, never a check at a call site.
 */

export type ForbiddenStaffRoleCombination<R extends string = string> = {
  readonly role: R;
  /** Roles it may not be held together with; `"any"` means it is only ever held alone. */
  readonly with: readonly R[] | "any";
  readonly why: string;
};

/** One admin's role rules: the role that must always keep a holder, and the pairs kept apart. */
export type StaffRoleRuleTable<R extends string> = {
  readonly administratorRole: R;
  readonly forbidden: readonly ForbiddenStaffRoleCombination<R>[];
};

export type StaffRoleChange<R extends string = string> =
  | {
      readonly kind: "assign";
      readonly role: R;
      readonly startsAt: Date;
      readonly endsAt: Date | null;
    }
  | { readonly kind: "remove"; readonly role: R };

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

export type StaffRoleAssignmentCheck<R extends string = string> =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: StaffRoleAssignmentRefusal;
      /** The role already held that the requested one cannot be combined with. */
      readonly conflictingRole?: R;
    };

export type StaffRoleSetCheck<R extends string = string> =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: Extract<StaffRoleAssignmentRefusal, "duplicate" | "forbidden_combination">;
      /** The role that cannot join the ones before it. */
      readonly role: R;
      readonly conflictingRole?: R;
    };

export type StaffRoleRules<R extends string> = {
  readonly table: StaffRoleRuleTable<R>;
  /** The rule that keeps `a` and `b` apart, or null when one person may hold both. */
  forbiddenCombination(a: R, b: R): ForbiddenStaffRoleCombination<R> | null;
  /** Whether one person may not hold `a` and `b` at the same time. */
  isForbiddenCombination(a: R, b: R): boolean;
  /**
   * Whether a person whose assignments are `current` may take the `requested` change at `now`.
   */
  check(
    current: readonly StaffRoleAssignment<R>[],
    requested: StaffRoleChange<R>,
    now: Date,
    roster: StaffRosterFacts,
  ): StaffRoleAssignmentCheck<R>;
  /**
   * Whether one person may be given every role in `roles` at once, as an invitation does: the
   * same rules as `check`, applied to each role after the ones before it.
   */
  checkSet(roles: readonly R[]): StaffRoleSetCheck<R>;
};

const OK = { ok: true } as const;

/** Any fixed instant works: every role in a set starts together and stays open. */
const SET_START = new Date(0);

/** Builds the role rules for one admin from its table. */
export function createStaffRoleRules<R extends string>(
  table: StaffRoleRuleTable<R>,
): StaffRoleRules<R> {
  const ruleForbids = (rule: ForbiddenStaffRoleCombination<R>, a: R, b: R) =>
    rule.role === a && (rule.with === "any" || rule.with.includes(b));

  const forbiddenCombination = (a: R, b: R): ForbiddenStaffRoleCombination<R> | null => {
    if (a === b) return null;
    return (
      table.forbidden.find((rule) => ruleForbids(rule, a, b) || ruleForbids(rule, b, a)) ?? null
    );
  };

  const isForbiddenCombination = (a: R, b: R) => forbiddenCombination(a, b) !== null;

  const checkAssign = (
    current: readonly StaffRoleAssignment<R>[],
    requested: Extract<StaffRoleChange<R>, { kind: "assign" }>,
    now: Date,
  ): StaffRoleAssignmentCheck<R> => {
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
    const conflict = overlapping.find((held) => isForbiddenCombination(held.role, requested.role));
    if (conflict) {
      return { ok: false, reason: "forbidden_combination", conflictingRole: conflict.role };
    }
    return OK;
  };

  const checkRemove = (
    current: readonly StaffRoleAssignment<R>[],
    requested: Extract<StaffRoleChange<R>, { kind: "remove" }>,
    now: Date,
    roster: StaffRosterFacts,
  ): StaffRoleAssignmentCheck<R> => {
    const held = current.filter(
      (a) => a.role === requested.role && isStaffRoleAssignmentCurrent(a, now),
    );
    if (held.length === 0) return { ok: false, reason: "not_assigned" };
    const removesActiveAdministrator =
      requested.role === table.administratorRole &&
      held.some((a) => isStaffRoleAssignmentActive(a, now));
    if (removesActiveAdministrator && roster.otherActiveAdministrators === 0) {
      return { ok: false, reason: "last_administrator" };
    }
    return OK;
  };

  const check: StaffRoleRules<R>["check"] = (current, requested, now, roster) =>
    requested.kind === "assign"
      ? checkAssign(current, requested, now)
      : checkRemove(current, requested, now, roster);

  const checkSet = (roles: readonly R[]): StaffRoleSetCheck<R> => {
    const granted: StaffRoleAssignment<R>[] = [];
    for (const role of roles) {
      const result = check(
        granted,
        { kind: "assign", role, startsAt: SET_START, endsAt: null },
        SET_START,
        { otherActiveAdministrators: 0 },
      );
      if (!result.ok) {
        return {
          ok: false,
          reason: result.reason === "duplicate" ? "duplicate" : "forbidden_combination",
          role,
          ...(result.conflictingRole ? { conflictingRole: result.conflictingRole } : {}),
        };
      }
      granted.push({ role, startsAt: SET_START, endsAt: null });
    }
    return OK;
  };

  return { table, forbiddenCombination, isForbiddenCombination, check, checkSet };
}
