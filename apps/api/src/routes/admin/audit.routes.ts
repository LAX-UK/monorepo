import {
  normalizeUserRoleOrClient,
  normalizeUserStaffRole,
  roleHasCapability,
} from "@auction/types";
import {
  adminAuditActorsQuerySchema,
  adminAuditLogQuerySchema,
  adminDomainEventsQuerySchema,
} from "@auction/validators";
import type { Context } from "hono";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuditDomainEvents } from "../../middleware/require-capability.js";
import type { AdminAuditRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

/** Unredacted fields are opt-in (`includePii=1`) and only for roles holding `audit.read_pii`. */
function wantsPii(c: Context): boolean {
  const role = normalizeUserRoleOrClient(c.get("userRole"));
  const staff = normalizeUserStaffRole(c.get("userStaffRole") as string | null | undefined);
  return c.req.query("includePii") === "1" && roleHasCapability(role, "audit.read_pii", staff);
}

export function attachAdminAuditRoutes(
  platform: AdminHono,
  container: AdminAuditRoutesContainer,
): void {
  /** GET /admin/audit/domain-events — paginated feed (PII redacted by default). */
  platform.get(
    "/audit/domain-events",
    requireAuditDomainEvents,
    zValidator("query", adminDomainEventsQuerySchema),
    async (c) => {
      const { limit, offset, eventTypePrefix, aggregateType, aggregateId } = c.req.valid("query");
      const includePii = wantsPii(c);
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

  /**
   * GET /admin/audit/log — the staff audit log: filtered by actor, entity, action, view, text and
   * date, newest first, with a total for paging. Each event names its actor and never carries
   * credentials.
   */
  platform.get(
    "/audit/log",
    requireAuditDomainEvents,
    zValidator("query", adminAuditLogQuerySchema),
    async (c) => {
      const { from, to, ...query } = c.req.valid("query");
      const data = await container.admin.auditLog.search({
        limit: query.limit,
        offset: query.offset,
        includePii: wantsPii(c),
        ...(query.q ? { q: query.q } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.view ? { view: query.view } : {}),
        ...(query.eventTypes ? { eventTypes: query.eventTypes } : {}),
        ...(query.aggregateType ? { aggregateType: query.aggregateType } : {}),
        ...(query.aggregateId ? { aggregateId: query.aggregateId } : {}),
        ...(from ? { fromDay: from } : {}),
        ...(to ? { toDay: to } : {}),
      });
      return c.json({ data });
    },
  );

  /** GET /admin/audit/actors — people who appear in the log, for the actor filter. */
  platform.get(
    "/audit/actors",
    requireAuditDomainEvents,
    zValidator("query", adminAuditActorsQuerySchema),
    async (c) => {
      const { q, limit } = c.req.valid("query");
      const data = await container.admin.auditLog.searchActors({
        limit,
        includePii: wantsPii(c),
        ...(q ? { q } : {}),
      });
      return c.json({ data });
    },
  );
}
