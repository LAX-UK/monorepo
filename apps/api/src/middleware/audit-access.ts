import type { StaffRoles } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { Logger } from "pino";

export function createAuditAccessMiddleware(log: Logger) {
  return createMiddleware<{
    Variables: { userId?: string; userStaffRoles?: StaffRoles | undefined };
  }>(async (c, next) => {
    await next();
    log.info(
      {
        actorId: c.get("userId"),
        actorStaffRoles: c.get("userStaffRoles"),
        method: c.req.method,
        path: c.req.path,
        requestId: c.req.header("x-request-id"),
      },
      "bullmq_admin_access",
    );
  });
}
