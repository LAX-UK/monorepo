import { z } from "zod";

export const adminDomainEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  /** Filter `event_type LIKE '<prefix>%'` (alphanumeric, dot, underscore only). */
  eventTypePrefix: z
    .string()
    .max(120)
    .regex(/^[a-zA-Z0-9._-]*$/, "Invalid event type prefix")
    .optional(),
});

/** Finance-only: Stripe dispute-related domain events (`payment.dispute%`). */
export const adminFinanceDisputeDomainEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
