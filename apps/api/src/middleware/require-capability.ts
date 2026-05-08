import { type RoleCapability, type UserRole, roleHasCapability } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { LegalEntityContext } from "./require-legal-entity-context.js";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireCapability(
  capability: RoleCapability,
  src: RoleSource = honoContextRoleSource,
) {
  return createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(
    async (c, next) => {
      const role = src.getRole(c) as UserRole;
      if (!roleHasCapability(role, capability)) {
        return c.json({ error: "Forbidden" }, 403);
      }
      await next();
    },
  );
}

export const requirePlatformAdmin = createRequireCapability("platform.admin.full");
export const requireFinanceAccess = createRequireCapability("finance.read");
export const requireUserInvite = createRequireCapability("user.invite");
export const requireArtistRead = createRequireCapability("artist.read");
export const requireArtistReview = createRequireCapability("artist.review");
export const requireArtistMerge = createRequireCapability("artist.merge");
export const requirePayoutRead = createRequireCapability("payout.read");
export const requirePayoutProcess = createRequireCapability("payout.process");
export const requirePayoutReverse = createRequireCapability("payout.reverse");
export const requireAuditReadPii = createRequireCapability("audit.read_pii");

const ENTITY_FINANCE_WRITE_ROLES = new Set(["owner", "admin", "finance"]);

export const requireFinanceEntityWrite = createMiddleware<{
  Variables: { userId?: string; userRole?: string; legalEntityContext?: LegalEntityContext };
}>(async (c, next) => {
  const role = c.get("userRole") as UserRole | undefined;
  if (role && roleHasCapability(role, "finance.entity.write")) {
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
