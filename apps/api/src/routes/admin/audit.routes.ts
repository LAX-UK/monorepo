import {
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import { adminDomainEventsQuerySchema } from "@auction/validators";
import type { Container } from "../../container.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuditDomainEvents } from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminAuditRoutes(platform: AdminHono, container: Container): void {
  /** GET /admin/audit/domain-events — paginated feed (PII redacted by default). */
  platform.get(
    "/audit/domain-events",
    requireAuditDomainEvents,
    zValidator("query", adminDomainEventsQuerySchema),
    async (c) => {
      const { limit, offset, eventTypePrefix, aggregateType, aggregateId } = c.req.valid("query");
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
      const includePii =
        c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii", staff);
      const data = await container.admin.domainEvents.listRedacted({
        limit,
        offset,
        includePii,
        ...(eventTypePrefix !== undefined ? { eventTypePrefix } : {}),
        ...(aggregateType !== undefined && aggregateId !== undefined
          ? { aggregateType, aggregateId }
          : {}),
      });
      return c.json({ data });
    },
  );
}
