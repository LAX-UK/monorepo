import type { UserRole } from "../user.js";
import type { RoleCapability } from "./role-capabilities.js";
import { roleHasCapability } from "./role-capabilities.js";
import { ADMINISTRATOR_STAFF_ROLE } from "./staff-role-assignment-rules.js";
import {
  NO_STAFF_ROLES,
  type StaffRoles,
  hasStaffRole,
  holdsOnlyStaffRole,
} from "./staff-roles.js";

/**
 * Whether the user may enter the platform admin route group (not finance-only shell).
 * Someone who holds only `finance` uses the finance shell + default destination
 * `/admin/finance`; any other role opens the platform shell.
 */
export function canAccessPlatformAdminRoutes(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  if (role !== "staff") return false;
  return staffRoles.some((held) => held !== "finance");
}

export function canAccessFinanceAdminRoutes(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  return roleHasCapability(role, "finance.read", staffRoles);
}

/** Admin submission list/detail (read). */
export function canAccessAdminSubmissionsRead(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  if (role !== "staff") return false;
  return roleHasCapability(role, "legal_entity.read", staffRoles);
}

/** Admin-only submission note patches while under review. */
export function canAccessAdminSubmissionNotesWrite(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): boolean {
  if (role !== "staff") return false;
  return userHasAccessTo(role, staffRoles, {
    anyOf: ["platform.admin.full", "catalogue.write", "specialist.appraise"],
  });
}

/** Nav / shell: capability requirement for a sidebar item. */
export type CapabilityRequirement = RoleCapability | { anyOf: RoleCapability[] };

/** The capabilities that each satisfy `requirement` on their own. */
export function requirementCapabilities(requirement: CapabilityRequirement): RoleCapability[] {
  return typeof requirement === "string" ? [requirement] : [...requirement.anyOf];
}

export function userHasAccessTo(
  role: UserRole,
  staffRoles: StaffRoles | undefined,
  requirement: CapabilityRequirement,
): boolean {
  if (typeof requirement === "object" && requirement !== null && "anyOf" in requirement) {
    return requirement.anyOf.some((c) => roleHasCapability(role, c, staffRoles));
  }
  return roleHasCapability(role, requirement as RoleCapability, staffRoles);
}

export type AppShellLayout = "client" | "platform" | "finance";

/** Visual shell for staff: finance-only vs platform vs client. */
export function staffRoleToShellLayout(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): AppShellLayout {
  if (role === "client") return "client";
  if (holdsOnlyStaffRole(staffRoles, "finance")) return "finance";
  return "platform";
}

/** First sensible admin URL for this staff user (post-login landing). */
export function staffRoleDefaultDestination(
  role: UserRole,
  staffRoles: StaffRoles = NO_STAFF_ROLES,
): string {
  if (role === "client") return "/home";
  if (staffRoles.length === 0) return "/admin";

  if (hasStaffRole(staffRoles, ADMINISTRATOR_STAFF_ROLE)) return "/admin";
  if (holdsOnlyStaffRole(staffRoles, "finance")) return "/admin/finance";

  const ordered: Array<{ path: string; requirement: CapabilityRequirement }> = [
    { path: "/admin/sales", requirement: "auction.manage" },
    { path: "/admin/saleroom", requirement: "saleroom.operate" },
    { path: "/admin/lots", requirement: "catalogue.write" },
    { path: "/admin/submissions", requirement: "specialist.appraise" },
    { path: "/admin/lot-fulfilment", requirement: "operations.fulfilment" },
    { path: "/admin/clients", requirement: "client.read" },
    { path: "/admin/compliance/aml", requirement: { anyOf: ["aml.review", "compliance.mlro"] } },
    { path: "/admin/legal-entities", requirement: "legal_entity.read" },
    { path: "/admin/artists", requirement: "artist.read" },
    {
      path: "/admin",
      requirement: {
        anyOf: [
          "auction.manage",
          "catalogue.write",
          "specialist.appraise",
          "support.respond",
          "artist.read",
          "admin.read",
        ],
      },
    },
  ];

  for (const { path, requirement } of ordered) {
    if (userHasAccessTo(role, staffRoles, requirement)) return path;
  }

  return "/admin";
}
