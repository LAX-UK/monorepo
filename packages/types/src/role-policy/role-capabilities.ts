import type { UserRole, UserStaffRole } from "../user.js";
import { normalizeUserStaffRole, userRoles } from "../user.js";
import { staffRoleHasCapability } from "./staff-capability-matrix.js";

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
