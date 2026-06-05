import {
  onsiteEventEmailBodySchema,
  onsiteEventPassTokenParamSchema,
  onsiteEventSlugParamSchema,
  submitOnsiteEventRsvpBodySchema,
} from "@auction/validators";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import {
  isOnsiteEventCheckInServiceError,
  isOnsiteEventRsvpServiceError,
} from "../lib/onsite-event-route-errors.js";
import { zValidator } from "../lib/z-validator.js";
import {
  checkOnsiteEventLookupEmailLimit,
  createOnsiteEventLookupRateLimitMiddleware,
  createOnsiteEventRsvpRateLimitMiddleware,
} from "../middleware/onsite-event-rate-limit.js";

function mapRsvpResponse(
  rsvp: {
    id: string;
    eventSlug: string;
    userId: string;
    attendanceSegment: string;
    plusOne: number;
    plusOneGuestName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  passUrl: string,
) {
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
    passUrl,
  };
}

export function createOnsiteEventRoutes(container: Container) {
  const r = new Hono();
  const apiPublicUrl = (container.env?.API_PUBLIC_URL ?? "https://api.lax.bid").replace(/\/$/, "");
  const lookupLimit = createOnsiteEventLookupRateLimitMiddleware(container.redis);
  const rsvpLimit = createOnsiteEventRsvpRateLimitMiddleware(container.redis);

  r.get("/:slug/config", zValidator("param", onsiteEventSlugParamSchema), async (c) => {
    const { slug } = c.req.valid("param");
    const config = await container.onsiteEventRsvpService.getPublicConfig(slug);
    if (isOnsiteEventRsvpServiceError(config)) {
      return c.json({ error: config.message, code: config.code }, asHttpStatus(config.status));
    }
    return c.json({ data: config });
  });

  r.post(
    "/:slug/lookup",
    lookupLimit,
    zValidator("param", onsiteEventSlugParamSchema),
    zValidator("json", onsiteEventEmailBodySchema),
    async (c) => {
      const { slug } = c.req.valid("param");
      const { email } = c.req.valid("json");
      const emailAllowed = await checkOnsiteEventLookupEmailLimit(container.redis, email);
      if (!emailAllowed) {
        return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
      }
      const lookup = await container.onsiteEventRsvpService.lookupByEmail(slug, email);
      if (isOnsiteEventRsvpServiceError(lookup)) {
        return c.json({ error: lookup.message, code: lookup.code }, asHttpStatus(lookup.status));
      }
      return c.json({ data: lookup });
    },
  );

  r.post(
    "/:slug/rsvp",
    rsvpLimit,
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
          data: mapRsvpResponse(result.data, result.passUrl),
          isUpdate: result.isUpdate,
        },
        result.isUpdate ? 200 : 201,
      );
    },
  );

  r.get("/:slug/pass/:token", zValidator("param", onsiteEventPassTokenParamSchema), async (c) => {
    const { slug, token } = c.req.valid("param");
    const pass = await container.onsiteEventCheckInService.getPassView(slug, token, apiPublicUrl);
    if (isOnsiteEventCheckInServiceError(pass)) {
      return c.json({ error: pass.message, code: pass.code }, asHttpStatus(pass.status));
    }
    c.header("Cache-Control", "no-store");
    return c.json({ data: pass });
  });

  r.get(
    "/:slug/pass/:token/qr.svg",
    zValidator("param", onsiteEventPassTokenParamSchema),
    async (c) => {
      const { slug, token } = c.req.valid("param");
      const pass = await container.onsiteEventCheckInService.getPassView(slug, token, apiPublicUrl);
      if (isOnsiteEventCheckInServiceError(pass)) {
        return c.json({ error: pass.message, code: pass.code }, asHttpStatus(pass.status));
      }
      const svg = await container.onsiteEventCheckInService.renderPassQrSvg(pass.passUrl);
      c.header("Content-Type", "image/svg+xml; charset=utf-8");
      c.header("Cache-Control", "no-store");
      return c.body(svg);
    },
  );

  return r;
}
