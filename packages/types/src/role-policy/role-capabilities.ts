import type { UserRole } from "../user.js";
import { userRoles } from "../user.js";
import { staffRolesCapabilities } from "./effective-permissions.js";
import type { RoleCapability } from "./role-capability.js";
import { NO_STAFF_ROLES, type StaffRoles } from "./staff-roles.js";

export type { RoleCapability } from "./role-capability.js";

const roleSet = new Set<string>(userRoles);

/** Maps persisted/session role strings to {@link UserRole} (cutover aliases included). */
export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  if (role == null || role === "") return null;
  const r = role.trim().toLowerCase();
  if (r === "administrator" || r === "admin" || r === "accountant") return "staff";
  if (r === "client" || r === "user" || r === "buyer" || r === "seller") return "client";
  if (roleSet.has(r as UserRole)) return r as UserRole;
  return null;
}

export function normalizeUserRoleOrClient(role: string | null | undefined): UserRole {
  return normalizeUserRole(role) ?? "client";
}

export function isKnownUserRole(role: string | null | undefined): role is UserRole {
  return normalizeUserRole(role) != null;
}

const CLIENT_CAPABILITIES: ReadonlySet<RoleCapability> = new Set(["bid.place", "client.submit"]);

/**
 * Everything the person may do: a client's fixed set, or for staff the union over the roles they
 * hold right now. A staff account with no role may do nothing, and staff never act as clients.
 */
export function effectiveCapabilities(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): ReadonlySet<RoleCapability> {
  if (role === "client") return CLIENT_CAPABILITIES;
  if (role === "staff") return staffRolesCapabilities(staffRoles);
  return new Set();
}

/** @param staffRoles The roles in force for a staff account; ignored for clients. */
export function roleHasCapability(
  role: UserRole,
  capability: RoleCapability,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  return effectiveCapabilities(role, staffRoles).has(capability);
}

export function canAccessStaffAdminShell(role: UserRole): boolean {
  return role === "staff";
}
