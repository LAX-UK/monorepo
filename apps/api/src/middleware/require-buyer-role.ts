import { type UserRole, roleHasCapability } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireBuyerRole(src: RoleSource = honoContextRoleSource) {
  return createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(
    async (c, next) => {
      const role = src.getRole(c) as UserRole;
      if (!roleHasCapability(role, "bid.place")) {
        return c.json({ error: "bidding_not_allowed_for_role" }, 403);
      }
      await next();
    },
  );
}

/** Default middleware using Hono context `userRole`. */
export const requireBuyerRole = createRequireBuyerRole();

/**
 * For routes where platform administrators take a different code path (e.g. PATCH submission).
 * Administrators skip buyer gate; everyone else must pass {@link createRequireBuyerRole}.
 */
export function createRequireBuyerRoleUnlessAdministrator(src: RoleSource = honoContextRoleSource) {
  const buyerOnly = createRequireBuyerRole(src);
  return createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(
    async (c, next) => {
      const role = src.getRole(c) as UserRole;
      if (roleHasCapability(role, "platform.admin.full")) {
        await next();
        return;
      }
      return buyerOnly(c, next);
    },
  );
}

export const requireBuyerRoleUnlessAdministrator = createRequireBuyerRoleUnlessAdministrator();

/** @deprecated Use {@link requireBuyerRoleUnlessAdministrator}. */
export const requireBuyerRoleUnlessAdmin = requireBuyerRoleUnlessAdministrator;
