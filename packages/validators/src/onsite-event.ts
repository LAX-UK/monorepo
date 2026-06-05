import { z } from "zod";

export const ONSITE_EVENT_SLUG_MAX = 64;
export const ONSITE_EVENT_RSVP_NOTES_MAX = 500;
export const ONSITE_EVENT_GUEST_NAME_MAX = 120;

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

export type OnsiteEventEmailBody = z.infer<typeof onsiteEventEmailBodySchema>;
export type SubmitOnsiteEventRsvpBody = z.infer<typeof submitOnsiteEventRsvpBodySchema>;
export type OnsiteEventCheckInBody = z.infer<typeof onsiteEventCheckInBodySchema>;
