import type { UserRole } from "./user.js";
import { userRoles } from "./user.js";

/** V1 capabilities used for centralized authorization. */
export type RoleCapability =
  | "platform.admin.full"
  | "finance.read"
  | "finance.write"
  | "user.invite"
  | "auction.manage"
  | "bid.place"
  | "client.submit";

const roleSet = new Set<string>(userRoles);

/**
 * Maps persisted/session role strings to V1 {@link UserRole}.
 * Returns null when the value cannot be mapped (unknown legacy).
 */
export function normalizeUserRole(role: string | null | undefined): UserRole | null {
  if (role == null || role === "") return null;
  const r = role.trim().toLowerCase();
  if (r === "administrator" || r === "admin") return "administrator";
  if (r === "accountant") return "accountant";
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

export function roleHasCapability(role: UserRole, capability: RoleCapability): boolean {
  switch (capability) {
    case "platform.admin.full":
      return role === "administrator";
    case "finance.read":
      return role === "administrator" || role === "accountant";
    case "finance.write":
      return role === "administrator" || role === "accountant";
    case "user.invite":
      return role === "administrator";
    case "auction.manage":
      return role === "administrator";
    case "bid.place":
      return role === "client";
    case "client.submit":
      return role === "client";
    default:
      return false;
  }
}

export function canAccessStaffAdminShell(role: UserRole): boolean {
  return role === "administrator" || role === "accountant";
}

export function canAccessPlatformAdminRoutes(role: UserRole): boolean {
  return roleHasCapability(role, "platform.admin.full");
}

export function canAccessFinanceAdminRoutes(role: UserRole): boolean {
  return roleHasCapability(role, "finance.read");
}
