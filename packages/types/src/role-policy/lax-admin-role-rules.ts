import {
  type LaxShopStaffRole,
  type LaxStaffGrant,
  laxShopStaffRoles,
} from "../lax-staff-platforms.js";
import { type StaffRoleAssignment, activeRolesOf } from "./staff-role-assignment.js";
import {
  type ForbiddenStaffRoleCombination,
  createStaffRoleRules,
} from "./staff-role-rule-engine.js";

/** LAX Admin's Administrator: holds every capability, and the roster must always keep one. */
export const LAX_ADMIN_ADMINISTRATOR_ROLE: LaxShopStaffRole = "shop_admin";

/**
 * Roles one person may not hold at the same time in LAX Admin. Each rule reads both ways. Add a
 * rule here rather than checking roles at call sites.
 */
export const FORBIDDEN_LAX_ADMIN_ROLE_COMBINATIONS: readonly ForbiddenStaffRoleCombination<LaxShopStaffRole>[] =
  [
    {
      role: "shop_admin",
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
      with: ["account_manager", "broker"],
      why: "Moving money and selling to clients are kept with different people.",
    },
  ];

/** LAX Admin's role rules, from the engine Bid admin uses with its own table. */
export const LAX_ADMIN_ROLE_RULES = createStaffRoleRules<LaxShopStaffRole>({
  administratorRole: LAX_ADMIN_ADMINISTRATOR_ROLE,
  forbidden: FORBIDDEN_LAX_ADMIN_ROLE_COMBINATIONS,
});

const ROLE_ORDER = new Map<LaxShopStaffRole, number>(laxShopStaffRoles.map((role, i) => [role, i]));

export function isLaxAdminRole(value: unknown): value is LaxShopStaffRole {
  return typeof value === "string" && ROLE_ORDER.has(value as LaxShopStaffRole);
}

/** Known LAX Admin roles only, each once, in catalogue order. */
export function normalizeLaxAdminRoles(
  values: readonly (string | null | undefined)[] | null | undefined,
): LaxShopStaffRole[] {
  const roles = new Set<LaxShopStaffRole>();
  for (const value of values ?? []) if (isLaxAdminRole(value)) roles.add(value);
  return [...roles].sort((a, b) => (ROLE_ORDER.get(a) ?? 0) - (ROLE_ORDER.get(b) ?? 0));
}

/** The LAX Admin roles in force at `now`, each once, in catalogue order. */
export function activeLaxAdminRoles(
  assignments: readonly StaffRoleAssignment<LaxShopStaffRole>[],
  now: Date,
): LaxShopStaffRole[] {
  return normalizeLaxAdminRoles(activeRolesOf(assignments, now));
}

/**
 * The one role shown where a screen has room for one (directory, badges). Display only:
 * capabilities always come from the whole set.
 */
export function primaryLaxAdminRole(roles: readonly LaxShopStaffRole[]): LaxShopStaffRole | null {
  return normalizeLaxAdminRoles(roles)[0] ?? null;
}

/** The LAX Admin roles among `grants`, in catalogue order. */
export function laxAdminRolesFromGrants(grants: readonly LaxStaffGrant[]): LaxShopStaffRole[] {
  return normalizeLaxAdminRoles(grants.filter((g) => g.product === "shop").map((g) => g.role));
}
