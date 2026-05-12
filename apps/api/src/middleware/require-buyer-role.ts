import { normalizeUserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { RoleSource } from "./role-source.js";
import { honoContextRoleSource } from "./role-source.js";

export function createRequireBuyerRole(src: RoleSource = honoContextRoleSource) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const role = normalizeUserRole(src.getRole(c) as string | null | undefined);
    const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
    if (role == null || !roleHasCapability(role, "bid.place", staff)) {
      return c.json({ error: "bidding_not_allowed_for_role" }, 403);
    }
    await next();
  });
}

/** Default middleware using Hono context `userRole`. */
export const requireBuyerRole = createRequireBuyerRole();

/** For routes where platform staff take a different code path (e.g. PATCH submission).
 * Staff skip buyer gate; everyone else must pass {@link createRequireBuyerRole}.
 */
export function createRequireBuyerRoleUnlessStaff(src: RoleSource = honoContextRoleSource) {
  const buyerOnly = createRequireBuyerRole(src);
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const role = normalizeUserRole(src.getRole(c) as string | null | undefined);
    if (role === "staff") {
      await next();
      return;
    }
    return buyerOnly(c, next);
  });
}

export const requireBuyerRoleUnlessStaff = createRequireBuyerRoleUnlessStaff();

/** @deprecated Use {@link createRequireBuyerRoleUnlessStaff}. */
export const createRequireBuyerRoleUnlessAdministrator = createRequireBuyerRoleUnlessStaff;

/** @deprecated Use {@link requireBuyerRoleUnlessStaff}. */
export const requireBuyerRoleUnlessAdministrator = requireBuyerRoleUnlessStaff;

/** @deprecated Use {@link requireBuyerRoleUnlessStaff}. */
export const requireBuyerRoleUnlessAdmin = requireBuyerRoleUnlessStaff;
