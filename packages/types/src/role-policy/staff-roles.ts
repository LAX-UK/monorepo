import { type UserStaffRole, normalizeUserStaffRole, userStaffRoles } from "../user.js";

/**
 * The staff roles a person holds right now. Order carries no meaning for permissions; it follows
 * {@link userStaffRoles} so the same set always looks the same.
 */
export type StaffRoles = readonly UserStaffRole[];

export const NO_STAFF_ROLES: StaffRoles = Object.freeze([]);

const ROLE_ORDER = new Map<UserStaffRole, number>(userStaffRoles.map((role, i) => [role, i]));

/** Known roles only, each once, in canonical order. Unknown or empty values are dropped. */
export function normalizeStaffRoles(
  values: readonly (string | null | undefined)[] | null | undefined,
): UserStaffRole[] {
  const roles = new Set<UserStaffRole>();
  for (const value of values ?? []) {
    const role = normalizeUserStaffRole(value);
    if (role) roles.add(role);
  }
  return [...roles].sort((a, b) => (ROLE_ORDER.get(a) ?? 0) - (ROLE_ORDER.get(b) ?? 0));
}

export function hasStaffRole(roles: StaffRoles, role: UserStaffRole): boolean {
  return roles.includes(role);
}

/** True when the person holds at least one role and every one of them is `role`. */
export function holdsOnlyStaffRole(roles: StaffRoles, role: UserStaffRole): boolean {
  return roles.length > 0 && roles.every((held) => held === role);
}

/**
 * The single role shown where a screen still has room for one (lists, badges). Display only:
 * permissions always come from the whole set.
 */
export function primaryStaffRole(roles: StaffRoles): UserStaffRole | null {
  return normalizeStaffRoles(roles)[0] ?? null;
}
