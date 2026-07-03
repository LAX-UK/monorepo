import { z } from "zod";

export const ONSITE_EVENT_SLUG_MAX = 64;
export const ONSITE_EVENT_RSVP_NOTES_MAX = 500;
export const ONSITE_EVENT_GUEST_NAME_MAX = 120;

/** Path segments the event microsite and API route table treat as keywords
 * (e.g. `event.lax.bid/pass/:token`, `/events/:slug`). An event slug matching
 * one of these would be unreachable or would shadow a route. */
export const ONSITE_EVENT_RESERVED_SLUGS = new Set([
  "pass",
  "events",
  "event",
  "config",
  "lookup",
  "rsvp",
  "admin",
  "api",
  "new",
]);

export const onsiteEventSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(ONSITE_EVENT_SLUG_MAX)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !ONSITE_EVENT_RESERVED_SLUGS.has(slug), {
    message: "This slug is reserved and cannot be used for an event",
  });

export const onsiteEventSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(ONSITE_EVENT_SLUG_MAX)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const onsiteEventEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

export const onsiteEventEmailBodySchema = z.object({
  email: onsiteEventEmailSchema,
});

export const onsiteEventSegmentOptionSchema = z.object({
  value: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(120),
  helper: z.string().trim().max(240).optional(),
});

export const submitOnsiteEventRsvpBodySchema = z
  .object({
    email: onsiteEventEmailSchema,
    attendanceSegment: z.string().trim().min(1).max(64),
    plusOne: z.coerce.number().int().min(0).max(1).default(0),
    plusOneGuestName: z.string().trim().max(ONSITE_EVENT_GUEST_NAME_MAX).optional(),
    notes: z.string().max(ONSITE_EVENT_RSVP_NOTES_MAX).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.plusOne > 0 && !body.plusOneGuestName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Guest name is required when bringing a plus-one",
        path: ["plusOneGuestName"],
      });
    }
    if (body.plusOne === 0 && body.plusOneGuestName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Guest name is only allowed when bringing a plus-one",
        path: ["plusOneGuestName"],
      });
    }
  });

export const ONSITE_EVENT_CHECK_IN_TOKEN_MAX = 128;

export const onsiteEventPassTokenParamSchema = z.object({
  slug: onsiteEventSlugParamSchema.shape.slug,
  token: z
    .string()
    .trim()
    .min(16)
    .max(ONSITE_EVENT_CHECK_IN_TOKEN_MAX)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export const onsiteEventPassTokenOnlyParamSchema = z.object({
  token: onsiteEventPassTokenParamSchema.shape.token,
});

export const onsiteEventCheckInBodySchema = z
  .object({
    token: z.string().trim().min(1).max(512).optional(),
    rsvpId: z.string().uuid().optional(),
  })
  .superRefine((body, ctx) => {
    if (!body.token?.trim() && !body.rsvpId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide a pass token or RSVP id",
        path: ["token"],
      });
    }
  });

export const onsiteEventCheckInSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
});

export const onsiteEventRsvpIdParamSchema = z.object({
  slug: onsiteEventSlugParamSchema.shape.slug,
  rsvpId: z.string().uuid(),
});

export const onsiteEventCheckInDryRunBodySchema = z.object({
  enabled: z.boolean(),
});

const onsiteEventIsoDateSchema = z.string().datetime({ offset: true }).nullable().optional();

export const createOnsiteEventBodySchema = z.object({
  slug: onsiteEventSlugSchema,
  title: z.string().trim().min(1).max(200),
  startsAt: onsiteEventIsoDateSchema,
  rsvpCloseAt: onsiteEventIsoDateSchema,
  segmentOptions: z.array(onsiteEventSegmentOptionSchema).min(1),
  opsEmail: z.string().trim().email().optional().nullable(),
  micrositeUrl: z.string().trim().url().optional().nullable(),
  venue: z.string().trim().max(240).optional().nullable(),
  dressCode: z.string().trim().max(120).optional().nullable(),
  arrivalNote: z.string().trim().max(500).optional().nullable(),
  status: z.enum(["draft", "published", "closed"]).default("draft"),
  saleId: z.string().uuid().nullable().optional(),
});

export const updateOnsiteEventBodySchema = createOnsiteEventBodySchema
  .omit({ slug: true })
  .partial();

export type CreateOnsiteEventBody = z.infer<typeof createOnsiteEventBodySchema>;
export type UpdateOnsiteEventBody = z.infer<typeof updateOnsiteEventBodySchema>;

export type OnsiteEventEmailBody = z.infer<typeof onsiteEventEmailBodySchema>;
export type SubmitOnsiteEventRsvpBody = z.infer<typeof submitOnsiteEventRsvpBodySchema>;
export type OnsiteEventCheckInBody = z.infer<typeof onsiteEventCheckInBodySchema>;
