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

export type OnsiteEventEmailBody = z.infer<typeof onsiteEventEmailBodySchema>;
export type SubmitOnsiteEventRsvpBody = z.infer<typeof submitOnsiteEventRsvpBodySchema>;
