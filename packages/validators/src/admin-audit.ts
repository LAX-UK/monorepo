import { AUDIT_LOG_VIEW_IDS } from "@auction/types";
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
    offset: z.coerce.number().int().min(0).max(50_000).default(0),
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

const eventTypeField = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-zA-Z0-9._-]+$/, "Invalid event type");

const calendarDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

/**
 * Staff audit log: filtered, newest first unless `sort` says otherwise. `eventTypes` is a comma-separated list of exact event
 * types; `view` narrows to a family of events; `from` and `to` are whole London days, inclusive.
 */
export const adminAuditLogSortSchema = z.enum(["at_desc", "at_asc"]);
export type AdminAuditLogSort = z.infer<typeof adminAuditLogSortSchema>;

export const adminAuditLogQuerySchema = z
  .object({
    sort: adminAuditLogSortSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(50_000).default(0),
    q: z.string().trim().max(100).optional(),
    actorUserId: z.string().min(1).max(191).optional(),
    view: z.enum(AUDIT_LOG_VIEW_IDS).optional(),
    aggregateType: aggregateTypeField.optional(),
    aggregateId: aggregateIdField.optional(),
    eventTypes: z
      .string()
      .max(2_000)
      .optional()
      .transform((value) =>
        value
          ? value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
          : undefined,
      )
      .pipe(z.array(eventTypeField).max(40).optional()),
    from: calendarDateField.optional(),
    to: calendarDateField.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.aggregateId && !data.aggregateType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "aggregateId needs an aggregateType",
        path: ["aggregateType"],
      });
    }
    if (data.from && data.to && data.from > data.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "from must not be after to",
        path: ["to"],
      });
    }
  });

export type AdminAuditLogQuery = z.infer<typeof adminAuditLogQuerySchema>;

/** Actor picker for the audit log: people who have acted, found by name or email. */
export const adminAuditActorsQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** Finance-only: Stripe dispute-related domain events (`payment.dispute%`). */
export const adminFinanceDisputeDomainEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
});

const disputeCaseStatusChip = z.enum(["open", "under_review", "closed"]);

/** Finance: the Disputes screen's list. `q` searches the dispute ID, lot, buyer and seller. */
export const adminDisputeDeskListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
  view: z.enum(["needs_allocation", "open", "under_review", "closed", "all"]).default("all"),
  q: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(60).optional(),
});

export type AdminDisputeDeskListQuery = z.infer<typeof adminDisputeDeskListQuerySchema>;

export const adminDisputeCaseIdParamSchema = z.object({ id: z.string().uuid() });

/** Allocating a dispute names why, for the audit log. */
export const ADMIN_DISPUTE_ALLOCATION_NOTE_MIN = 10;
export const ADMIN_DISPUTE_ALLOCATION_NOTE_MAX = 500;

export const adminDisputeAllocationBodySchema = z.object({
  /** The case version the finance user saw. */
  expectedVersion: z.number().int().min(1),
  lines: z
    .array(
      z.object({
        paymentId: z.string().uuid(),
        amountPence: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(50),
  note: z
    .string()
    .trim()
    .min(ADMIN_DISPUTE_ALLOCATION_NOTE_MIN)
    .max(ADMIN_DISPUTE_ALLOCATION_NOTE_MAX),
});

export type AdminDisputeAllocationBody = z.infer<typeof adminDisputeAllocationBodySchema>;

/** Finance-only: folded Stripe dispute cases derived from domain events. */
export const adminFinanceDisputesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
  status: disputeCaseStatusChip.optional(),
});
