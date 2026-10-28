import {
  type UserRole,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  roleHasCapability,
  userHasAccessTo,
} from "@auction/types";
import { AuthzError } from "./authz-error.js";
import type { ExportAuthContext } from "./types.js";

function roleOf(ctx: ExportAuthContext): UserRole {
  return normalizeUserRoleOrClient(ctx.userRole);
}

export function requireCatalogueStaff(ctx: ExportAuthContext): void {
  if (
    !userHasAccessTo(roleOf(ctx), ctx.userStaffRoles, {
      anyOf: ["auction.manage", "catalogue.write"],
    })
  ) {
    throw new AuthzError("Catalogue export requires staff catalogue access", 403);
  }
}

export function requirePlatformAdminAccess(ctx: ExportAuthContext): void {
  if (!canAccessPlatformAdminRoutes(roleOf(ctx), ctx.userStaffRoles)) {
    throw new AuthzError("Admin export requires platform admin access", 403);
  }
}

export function requireFinanceRead(ctx: ExportAuthContext): void {
  if (!roleHasCapability(roleOf(ctx), "finance.read", ctx.userStaffRoles)) {
    throw new AuthzError("Finance export requires finance.read", 403);
  }
}

/** Staff who may read payouts across entities: `payout.read`, or the platform admin shell. */
export function canReadAllPayouts(ctx: ExportAuthContext): boolean {
  const role = roleOf(ctx);
  return (
    roleHasCapability(role, "payout.read", ctx.userStaffRoles) ||
    canAccessPlatformAdminRoutes(role, ctx.userStaffRoles)
  );
}

export function requirePayoutRead(ctx: ExportAuthContext): void {
  if (canReadAllPayouts(ctx)) return;
  if (roleOf(ctx) === "client") return;
  throw new AuthzError("Payout export not allowed", 403);
}

export function resolveIncludePii(
  ctx: ExportAuthContext,
  includePii: boolean | undefined,
): boolean {
  if (!includePii) return false;
  if (!roleHasCapability(roleOf(ctx), "audit.read_pii", ctx.userStaffRoles)) {
    throw new AuthzError("PII export requires audit.read_pii", 403);
  }
  return true;
}
