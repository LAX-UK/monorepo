import { createMiddleware } from "hono/factory";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireBuyerRole(src: RoleSource = honoContextRoleSource) {
  return createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(
    async (c, next) => {
      if (src.getRole(c) === "admin") {
        return c.json({ error: "admin_cannot_buy" }, 403);
      }
      await next();
    },
  );
}

/** Default middleware using Hono context `userRole`. */
export const requireBuyerRole = createRequireBuyerRole();

/**
 * For routes where admins take a different code path (e.g. PATCH submission).
 * Admins skip buyer gate; non-admins must pass {@link createRequireBuyerRole}.
 */
export function createRequireBuyerRoleUnlessAdmin(src: RoleSource = honoContextRoleSource) {
  const buyerOnly = createRequireBuyerRole(src);
  return createMiddleware<{ Variables: { userId?: string; userRole?: string } }>(
    async (c, next) => {
      if (src.getRole(c) === "admin") {
        await next();
        return;
      }
      return buyerOnly(c, next);
    },
  );
}

export const requireBuyerRoleUnlessAdmin = createRequireBuyerRoleUnlessAdmin();
