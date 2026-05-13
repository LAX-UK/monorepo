import { z } from "zod";

const aggregateTypeField = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9._-]+$/, "Invalid aggregate type");

const aggregateIdField = z.string().min(1).max(191);

export const adminDomainEventsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).default(100),
    /** Filter `event_type LIKE '<prefix>%'` (alphanumeric, dot, underscore only). */
    eventTypePrefix: z
      .string()
      .max(120)
      .regex(/^[a-zA-Z0-9._-]*$/, "Invalid event type prefix")
      .optional(),
    /** When both are set, return events for this aggregate only (chronological order). */
    aggregateType: aggregateTypeField.optional(),
    aggregateId: aggregateIdField.optional(),
  })
  .superRefine((data, ctx) => {
    const at = data.aggregateType?.trim() ?? "";
    const aid = data.aggregateId?.trim() ?? "";
    const hasAgg = at.length > 0 && aid.length > 0;
    const hasHalf = at.length > 0 !== aid.length > 0;
    if (hasHalf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "aggregateType and aggregateId must both be set together",
        path: ["aggregateId"],
      });
    }
    if (hasAgg && data.eventTypePrefix?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either an aggregate filter or eventTypePrefix, not both",
        path: ["eventTypePrefix"],
      });
    }
  });

/** GET /admin/audit/domain-events/export — optional aggregate filter (same pairing rules as feed). */
export const adminDomainEventsExportQuerySchema = z
  .object({
    format: z.enum(["csv", "json"]).optional().default("json"),
    limit: z.coerce.number().int().min(1).max(5000).optional().default(5000),
    aggregateType: aggregateTypeField.optional(),
    aggregateId: aggregateIdField.optional(),
  })
  .superRefine((data, ctx) => {
    const at = data.aggregateType?.trim() ?? "";
    const aid = data.aggregateId?.trim() ?? "";
    const hasHalf = at.length > 0 !== aid.length > 0;
    if (hasHalf) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "aggregateType and aggregateId must both be set together",
        path: ["aggregateId"],
      });
    }
  });

/** Finance-only: Stripe dispute-related domain events (`payment.dispute%`). */
export const adminFinanceDisputeDomainEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
