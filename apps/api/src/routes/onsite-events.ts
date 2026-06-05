import {
  onsiteEventEmailBodySchema,
  onsiteEventSlugParamSchema,
  submitOnsiteEventRsvpBodySchema,
} from "@auction/validators";
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

function mapRsvpResponse(rsvp: {
  id: string;
  eventSlug: string;
  userId: string;
  attendanceSegment: string;
  plusOne: number;
  plusOneGuestName: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: rsvp.id,
    eventSlug: rsvp.eventSlug,
    userId: rsvp.userId,
    attendanceSegment: rsvp.attendanceSegment,
    plusOne: rsvp.plusOne,
    plusOneGuestName: rsvp.plusOneGuestName,
    notes: rsvp.notes,
    createdAt: rsvp.createdAt.toISOString(),
    updatedAt: rsvp.updatedAt.toISOString(),
  };
}

export function createOnsiteEventRoutes(container: Container) {
  const r = new Hono();

  r.get("/:slug/config", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const config = await container.onsiteEventRsvpService.getPublicConfig(slug);
    if (isServiceError(config)) {
      return c.json({ error: config.message, code: config.code }, asHttpStatus(config.status));
    }
    return c.json({ data: config });
  });

  r.post(
    "/:slug/lookup",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", onsiteEventEmailBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { email } = c.req.valid("json");
      const lookup = await container.onsiteEventRsvpService.lookupByEmail(slug, email);
      if (isServiceError(lookup)) {
        return c.json({ error: lookup.message, code: lookup.code }, asHttpStatus(lookup.status));
      }
      return c.json({ data: lookup });
    },
  );

  r.post(
    "/:slug/rsvp",
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", submitOnsiteEventRsvpBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.onsiteEventRsvpService.submitRsvp(slug, body);
      if (!result.ok) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json(
        {
          data: mapRsvpResponse(result.data),
          isUpdate: result.isUpdate,
        },
        result.isUpdate ? 200 : 201,
      );
    },
  );

  return r;
}
