import type { UserRole, UserStaffRole } from "./user.js";
import { normalizeUserStaffRole, userRoles } from "./user.js";

/** V1 capabilities used for centralized authorization. */
export type RoleCapability =
  | "platform.admin.full"
  | "finance.read"
  | "finance.platform.write"
  | "finance.entity.write"
  /** @deprecated Use finance.platform.write for platform-wide writes. */
  | "finance.write"
  | "user.invite"
  | "auction.manage"
  | "bid.place"
  | "client.submit"
  | "legal_entity.read"
  | "legal_entity.write"
  | "legal_entity.approve"
  | "legal_entity.archive"
  | "artist.read"
  | "artist.review"
  | "artist.merge"
  | "artist.delete"
  | "payout.read"
  | "payout.process"
  | "payout.reverse"
  | "audit.read_pii"
  | "catalogue.write"
  | "specialist.appraise"
  | "operations.fulfilment"
  | "content.write"
  | "support.respond"
  /** Read client/staff directory and profile detail (no moderation or role changes). */
  | "client.read"
  /** Read per-client bid transaction history in admin. */
  | "bids.read"
  /** Review and disposition AML/sanctions watchlist screenings. */
  | "aml.review"
  /** MLRO authority: lift/confirm AML holds and approve Source-of-Funds. */
  | "compliance.mlro";

const roleSet = new Set<string>(userRoles);

const ALL_STAFF_CAPABILITIES_EXCEPT_CLIENT: RoleCapability[] = [
  "platform.admin.full",
  "finance.read",
  "finance.platform.write",
  "finance.entity.write",
  "finance.write",
  "user.invite",
  "auction.manage",
  "legal_entity.read",
  "legal_entity.write",
  "legal_entity.approve",
  "legal_entity.archive",
  "artist.read",
  "artist.review",
  "artist.merge",
  "artist.delete",
  "payout.read",
  "payout.process",
  "payout.reverse",
  "audit.read_pii",
  "catalogue.write",
  "specialist.appraise",
  "operations.fulfilment",
  "content.write",
  "support.respond",
  "client.read",
  "bids.read",
  "aml.review",
  "compliance.mlro",
];

const SUPER_ADMIN_CAPS = new Set<RoleCapability>(ALL_STAFF_CAPABILITIES_EXCEPT_CLIENT);

const STAFF_MATRIX: Record<Exclude<UserStaffRole, "super_admin">, Set<RoleCapability>> = {
  auction_manager: new Set([
    "auction.manage",
    "legal_entity.read",
    "legal_entity.write",
    "artist.read",
  ]),
  catalogue_manager: new Set([
    "catalogue.write",
    "artist.read",
    "artist.review",
    "artist.delete",
    "legal_entity.read",
  ]),
  specialist: new Set(["specialist.appraise", "artist.read", "artist.review", "legal_entity.read"]),
  finance_ops: new Set([
    "finance.read",
    "finance.platform.write",
    "payout.read",
    "payout.process",
    "legal_entity.read",
  ]),
  operations_fulfilment: new Set(["operations.fulfilment", "legal_entity.read", "artist.read"]),
  content_marketing: new Set(["content.write", "artist.read"]),
  support_concierge: new Set(["support.respond", "legal_entity.read", "artist.read"]),
  staff_viewer: new Set(["legal_entity.read", "artist.read"]),
  // MLRO / compliance officer: AML review + Source-of-Funds disposition. Reads
  // PII on screening records (audit.read_pii) and the user directory it relates to.
  compliance_officer: new Set([
    "aml.review",
    "compliance.mlro",
    "legal_entity.read",
    "audit.read_pii",
  ]),
  client_advisor: new Set(["client.read", "bids.read", "legal_entity.read", "artist.read"]),
  operations: new Set([
    "catalogue.write",
    "auction.manage",
    "operations.fulfilment",
    "legal_entity.read",
    "artist.read",
    "client.read",
  ]),
};

function staffRoleHasCapability(staff: UserStaffRole, capability: RoleCapability): boolean {
  if (staff === "super_admin") return SUPER_ADMIN_CAPS.has(capability);
  return STAFF_MATRIX[staff].has(capability);
}

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

/** @param staffRole Required when `role` is `staff`; null/undefined => no staff capabilities. */
export function roleHasCapability(
  role: UserRole,
  capability: RoleCapability,
  staffRole?: UserStaffRole | null,
): boolean {
  const staff = staffRole === undefined ? null : normalizeUserStaffRole(staffRole ?? undefined);

  if (role === "client") {
    switch (capability) {
      case "bid.place":
      case "client.submit":
        return true;
      default:
        return false;
    }
  }

  if (role === "staff") {
    if (staff == null) return false;
    return staffRoleHasCapability(staff, capability);
  }

  return false;
}

export function canAccessStaffAdminShell(role: UserRole): boolean {
  return role === "staff";
}

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
