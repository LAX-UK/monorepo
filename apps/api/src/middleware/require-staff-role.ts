import {
  ADMINISTRATOR_STAFF_ROLE,
  NO_STAFF_ROLES,
  type StaffRoles,
  hasStaffRole,
} from "@auction/types";
import { createMiddleware } from "hono/factory";

/** Engineering ops: only an administrator may access BullMQ admin surfaces. */
export const requireSuperAdminStaffRole = createMiddleware<{
  Variables: { userStaffRoles?: StaffRoles | undefined };
}>(async (c, next) => {
  if (!hasStaffRole(c.get("userStaffRoles") ?? NO_STAFF_ROLES, ADMINISTRATOR_STAFF_ROLE)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});
