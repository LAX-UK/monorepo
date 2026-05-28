import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { AuthzError } from "../lib/errors.js";
import type { ExportAuthContext } from "./types.js";

export function requireCatalogueStaff(ctx: ExportAuthContext): void {
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  if (
    !roleHasCapability(role, "auction.manage", staff) &&
    !roleHasCapability(role, "catalogue.write", staff)
  ) {
    throw new AuthzError("Catalogue export requires staff catalogue access", 403);
  }
}

export function requirePlatformAdminAccess(ctx: ExportAuthContext): void {
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  if (!canAccessPlatformAdminRoutes(role, staff)) {
    throw new AuthzError("Admin export requires platform admin access", 403);
  }
}

export function requireFinanceRead(ctx: ExportAuthContext): void {
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  if (!roleHasCapability(role, "finance.read", staff)) {
    throw new AuthzError("Finance export requires finance.read", 403);
  }
}

export function requirePayoutRead(ctx: ExportAuthContext): void {
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  if (roleHasCapability(role, "payout.read", staff) || canAccessPlatformAdminRoutes(role, staff)) {
    return;
  }
  if (role === "client") return;
  throw new AuthzError("Payout export not allowed", 403);
}

export function resolveIncludePii(
  ctx: ExportAuthContext,
  includePii: boolean | undefined,
): boolean {
  if (!includePii) return false;
  const role = normalizeUserRoleOrClient(ctx.userRole) as UserRole;
  const staff = normalizeUserStaffRole(ctx.userStaffRole ?? undefined);
  if (!roleHasCapability(role, "audit.read_pii", staff)) {
    throw new AuthzError("PII export requires audit.read_pii", 403);
  }
  return true;
}

export function exportAuthContextFromRow(row: {
  userId: string;
  userRole: string;
  userStaffRole: string | null;
}): ExportAuthContext {
  return {
    userId: row.userId,
    userRole: row.userRole,
    userStaffRole: row.userStaffRole,
  };
}
