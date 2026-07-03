import {
  createOnsiteEventBodySchema,
  onsiteEventCheckInBodySchema,
  onsiteEventCheckInDryRunBodySchema,
  onsiteEventCheckInSearchQuerySchema,
  onsiteEventRsvpIdParamSchema,
  onsiteEventSlugParamSchema,
  updateOnsiteEventBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import {
  isOnsiteEventCheckInServiceError,
  isOnsiteEventRsvpServiceError,
} from "../lib/onsite-event-route-errors.js";
import { zValidator } from "../lib/z-validator.js";
import { createOnsiteEventResendRateLimitMiddleware } from "../middleware/onsite-event-rate-limit.js";

export function createAdminOnsiteEventRoutes(container: Container) {
  const r = new Hono<{ Variables: { userId?: string } }>();
  const resendLimit = createOnsiteEventResendRateLimitMiddleware(container.redis);

  r.get("/", async (c) => {
    const rows = await container.onsiteEventAdminService.listAdminEvents();
    return c.json({ data: rows });
  });

  r.post("/", zValidator("json", createOnsiteEventBodySchema), async (c) => {
    const body = c.req.valid("json");
    const created = await container.onsiteEventAdminService.createAdminEvent(body);
    if (isOnsiteEventRsvpServiceError(created)) {
      return c.json({ error: created.message, code: created.code }, asHttpStatus(created.status));
    }
    return c.json({ data: created }, 201);
  });

  r.get("/:slug", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const detail = await container.onsiteEventAdminService.getAdminEventDetail(slug);
    if (isOnsiteEventRsvpServiceError(detail)) {
      return c.json({ error: detail.message, code: detail.code }, asHttpStatus(detail.status));
    }
    return c.json({ data: detail });
  });

  r.patch(
    "/:slug",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", updateOnsiteEventBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const body = c.req.valid("json");
      const updated = await container.onsiteEventAdminService.updateAdminEvent(slug, body);
      if (isOnsiteEventRsvpServiceError(updated)) {
        return c.json({ error: updated.message, code: updated.code }, asHttpStatus(updated.status));
      }
      return c.json({ data: updated });
    },
  );

  r.get("/:slug/rsvps", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const rows = await container.onsiteEventAdminService.listAdminRsvps(slug);
    if (isOnsiteEventRsvpServiceError(rows)) {
      return c.json({ error: rows.message, code: rows.code }, asHttpStatus(rows.status));
    }
    return c.json({ data: rows });
  });

  r.get("/:slug/rsvps/export", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const csv = await container.onsiteEventAdminService.exportAdminCsv(slug);
    if (isOnsiteEventRsvpServiceError(csv)) {
      return c.json({ error: csv.message, code: csv.code }, asHttpStatus(csv.status));
    }
    const filename = `${slug}-rsvps.csv`;
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  });

  r.get("/:slug/check-in/stats", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const stats = await container.onsiteEventStaffCheckInService.getCheckInStats(slug);
    if (isOnsiteEventCheckInServiceError(stats)) {
      return c.json({ error: stats.message, code: stats.code }, asHttpStatus(stats.status));
    }
    return c.json({ data: stats });
  });

  r.get(
    "/:slug/check-in/search",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("query", onsiteEventCheckInSearchQuerySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { q } = c.req.valid("query");
      const rows = await container.onsiteEventStaffCheckInService.searchGuests(slug, q);
      if (isOnsiteEventCheckInServiceError(rows)) {
        return c.json({ error: rows.message, code: rows.code }, asHttpStatus(rows.status));
      }
      return c.json({ data: rows });
    },
  );

  r.post(
    "/:slug/rsvps/:rsvpId/resend-pass",
    resendLimit,
    zValidator("param", onsiteEventRsvpIdParamSchema),
    async (c) => {
      const { slug, rsvpId } = c.req.valid("param");
      const staffUserId = c.get("userId");
      if (!staffUserId) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const result = await container.onsiteEventAdminService.resendPass(slug, rsvpId);
      if (!result.ok) {
        return c.json(
          { error: result.error.message, code: result.error.code },
          asHttpStatus(result.error.status),
        );
      }
      await container.onsiteEventStaffCheckInService.recordPassResend(slug, rsvpId, staffUserId);
      return c.json({ data: { rotated: result.rotated, emailSent: result.emailSent } });
    },
  );

  r.patch(
    "/:slug/check-in/dry-run",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", onsiteEventCheckInDryRunBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { enabled } = c.req.valid("json");
      const result = await container.onsiteEventAdminService.setCheckInDryRun(slug, enabled);
      if (!result.ok) {
        return c.json(
          { error: result.error.message, code: result.error.code },
          asHttpStatus(result.error.status),
        );
      }
      return c.json({ data: { checkInDryRun: result.checkInDryRun } });
    },
  );

  r.post(
    "/:slug/check-in",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", onsiteEventCheckInBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const body = c.req.valid("json");
      const staffUserId = c.get("userId");
      if (!staffUserId) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const checkInInput: { token?: string; rsvpId?: string } = {};
      if (body.token) checkInInput.token = body.token;
      if (body.rsvpId) checkInInput.rsvpId = body.rsvpId;
      const result = await container.onsiteEventStaffCheckInService.checkIn(
        slug,
        checkInInput,
        staffUserId,
      );
      return c.json({ data: result });
    },
  );

  return r;
}
