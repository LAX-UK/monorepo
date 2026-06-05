import { onsiteEventSlugParamSchema } from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import type { OnsiteEventRsvpServiceError } from "../services/interfaces/onsite-event-rsvp-service.js";

function isServiceError(value: unknown): value is OnsiteEventRsvpServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof (value as OnsiteEventRsvpServiceError).status === "number" &&
    "message" in value
  );
}

export function createAdminOnsiteEventRoutes(container: Container) {
  const r = new Hono();

  r.get("/", async (c) => {
    const rows = await container.onsiteEventRsvpService.listAdminEvents();
    return c.json({ data: rows });
  });

  r.get("/:slug/rsvps", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const rows = await container.onsiteEventRsvpService.listAdminRsvps(slug);
    if (isServiceError(rows)) {
      return c.json({ error: rows.message, code: rows.code }, asHttpStatus(rows.status));
    }
    return c.json({ data: rows });
  });

  r.get("/:slug/rsvps/export", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const csv = await container.onsiteEventRsvpService.exportAdminCsv(slug);
    if (isServiceError(csv)) {
      return c.json({ error: csv.message, code: csv.code }, asHttpStatus(csv.status));
    }
    const filename = `${slug}-rsvps.csv`;
    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", `attachment; filename="${filename}"`);
    return c.body(csv);
  });

  return r;
}
