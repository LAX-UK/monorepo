import { normalizeUserStaffRole } from "@auction/types";
import { createMiddleware } from "hono/factory";

/** Engineering ops: only super_admin may access BullMQ admin surfaces. */
export const requireSuperAdminStaffRole = createMiddleware<{
  Variables: { userStaffRole?: string | null };
}>(async (c, next) => {
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  if (staff !== "super_admin") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});
