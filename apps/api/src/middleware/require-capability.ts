import { roleHasCapability, type RoleCapability, type UserRole } from "@auction/types";
import { createMiddleware } from "hono/factory";
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
