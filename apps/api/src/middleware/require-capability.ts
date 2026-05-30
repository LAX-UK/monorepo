import {
  type RoleCapability,
  type UserRole,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { LegalEntityContext } from "./require-legal-entity-context.js";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireCapability(
  capability: RoleCapability,
  src: RoleSource = honoContextRoleSource,
) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const role = src.getRole(c) as UserRole;
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (!roleHasCapability(role, capability, staff)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

/** Staff who are not finance-shell-only may enter the platform admin route group. */
export const requirePlatformAdmin = createMiddleware<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>(async (c, next) => {
  const role = normalizeUserRoleOrClient(c.get("userRole"));
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (!canAccessPlatformAdminRoutes(role, staff)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});

export const requireFinanceAccess = createRequireCapability("finance.read");
export const requireUserInvite = createRequireCapability("user.invite");
export const requireArtistRead = createRequireCapability("artist.read");
export const requireArtistReview = createRequireCapability("artist.review");
export const requireArtistMerge = createRequireCapability("artist.merge");
export const requireArtistDelete = createRequireCapability("artist.delete");
export const requirePayoutRead = createRequireCapability("payout.read");
export const requirePayoutProcess = createRequireCapability("payout.process");
export const requirePayoutReverse = createRequireCapability("payout.reverse");
export const requireAuditReadPii = createRequireCapability("audit.read_pii");
export const requireOperationsFulfilment = createRequireCapability("operations.fulfilment");
export const requireCatalogueWrite = createRequireCapability("catalogue.write");
export const requireSpecialistAppraise = createRequireCapability("specialist.appraise");
export const requireAuctionManage = createRequireCapability("auction.manage");

/** Condition report queue: specialists, catalogue editors, or full auction managers. */
export const requireSpecialistCatalogueOrAuctionManage = createMiddleware<{
  Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
}>(async (c, next) => {
  const role = honoContextRoleSource.getRole(c) as UserRole;
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (
    roleHasCapability(role, "specialist.appraise", staff) ||
    roleHasCapability(role, "catalogue.write", staff) ||
    roleHasCapability(role, "auction.manage", staff)
  ) {
    await next();
    return;
  }
  return c.json({ error: "Forbidden" }, 403);
});

const ENTITY_FINANCE_WRITE_ROLES = new Set(["owner", "admin", "finance"]);

export const requireFinanceEntityWrite = createMiddleware<{
  Variables: {
    userId?: string;
    userRole?: string;
    userStaffRole?: string | null;
    legalEntityContext?: LegalEntityContext;
  };
}>(async (c, next) => {
  const role = c.get("userRole") as UserRole | undefined;
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (role && roleHasCapability(role, "finance.entity.write", staff)) {
    await next();
    return;
  }
  const ctx = c.get("legalEntityContext");
  if (ctx && ENTITY_FINANCE_WRITE_ROLES.has(ctx.role)) {
    await next();
    return;
  }
  return c.json({ error: "insufficient_entity_finance_role" }, 403);
});
