import type { UserRole, UserStaffRole } from "../user.js";
import { normalizeUserStaffRole } from "../user.js";
import type { RoleCapability } from "./role-capabilities.js";
import { roleHasCapability } from "./role-capabilities.js";

/**
 * Whether the user may enter the platform admin route group (not finance-only shell).
 * `finance_ops` uses the finance shell + default destination `/admin/payments`.
 */
export function canAccessPlatformAdminRoutes(
  role: UserRole,
  staffRole?: UserStaffRole | null,
): boolean {
  if (role !== "staff") return false;
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  if (staff == null) return false;
  return staff !== "finance_ops";
}

export function canAccessFinanceAdminRoutes(
  role: UserRole,
  staffRole?: UserStaffRole | null,
): boolean {
  return roleHasCapability(role, "finance.read", staffRole);
}

/** Admin submission list/detail (read). */
export function canAccessAdminSubmissionsRead(
  role: UserRole,
  staffRole?: UserStaffRole | null,
): boolean {
  if (role !== "staff") return false;
  return roleHasCapability(role, "legal_entity.read", staffRole);
}

/** Admin-only submission note patches while under review. */
export function canAccessAdminSubmissionNotesWrite(
  role: UserRole,
  staffRole?: UserStaffRole | null,
): boolean {
  if (role !== "staff") return false;
  return (
    roleHasCapability(role, "platform.admin.full", staffRole) ||
    roleHasCapability(role, "catalogue.write", staffRole) ||
    roleHasCapability(role, "specialist.appraise", staffRole)
  );
}

/** Nav / shell: capability requirement for a sidebar item. */
export type CapabilityRequirement = RoleCapability | { anyOf: RoleCapability[] };

export function userHasAccessTo(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
  requirement: CapabilityRequirement,
): boolean {
  if (typeof requirement === "object" && requirement !== null && "anyOf" in requirement) {
    return requirement.anyOf.some((c) => roleHasCapability(role, c, staffRole));
  }
  return roleHasCapability(role, requirement as RoleCapability, staffRole);
}

export type AppShellLayout = "client" | "platform" | "finance";

/** Visual shell for staff: finance-only vs platform vs client. */
export function staffRoleToShellLayout(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
): AppShellLayout {
  if (role === "client") return "client";
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  if (staff === "finance_ops") return "finance";
  return "platform";
}

/** First sensible admin URL for this staff user (post-login landing). */
export function staffRoleDefaultDestination(
  role: UserRole,
  staffRole: UserStaffRole | null | undefined,
): string {
  if (role === "client") return "/dashboard";
  const staff = normalizeUserStaffRole(staffRole ?? undefined);
  if (staff == null) return "/admin";

  if (staff === "super_admin") return "/admin";
  if (staff === "finance_ops") return "/admin/finance";

  const ordered: Array<{ path: string; requirement: CapabilityRequirement }> = [
    { path: "/admin/sales", requirement: "auction.manage" },
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
          "content.write",
          "support.respond",
          "artist.read",
        ],
      },
    },
  ];

  for (const { path, requirement } of ordered) {
    if (userHasAccessTo(role, staff, requirement)) return path;
  }

  return "/admin";
}
