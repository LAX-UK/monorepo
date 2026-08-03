import { z } from "zod";

export const adminWorkItemKindSchema = z.enum([
  "payment_manual_review",
  "aml_screening",
  "sof_case",
  "submission_review",
  "condition_report",
  "lot_fulfilment",
  "sale_registration",
  "telephone_booking",
  "legal_entity_kyb",
  "lot_withdrawal",
  "lot_draft_past_start",
]);

export const adminWorkItemDomainSchema = z.enum([
  "finance",
  "compliance",
  "catalogue",
  "saleroom",
  "fulfilment",
  "clients",
]);

export const adminWorkItemSeveritySchema = z.enum(["critical", "high", "medium", "low"]);

export const adminWorkItemActionSchema = z.enum([
  "start_review",
  "approve",
  "reject",
  "assign_to_me",
  "mark_in_progress",
  "decline",
  "capture",
  "refund",
  "approve_registration",
  "reject_registration",
  "confirm_telephone",
  "assign_clerk",
  "release_fulfilment",
  "ready_for_collection",
  "delivered",
]);

export const adminWorkItemSchema = z.object({
  id: z.string(),
  kind: adminWorkItemKindSchema,
  domain: adminWorkItemDomainSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  href: z.string(),
  saleId: z.string().nullable(),
  createdAt: z.string(),
  sourceUpdatedAt: z.string(),
  dueAt: z.string().nullable(),
  severity: adminWorkItemSeveritySchema,
  assignedToUserId: z.string().nullable(),
  actions: z.array(adminWorkItemActionSchema),
});

export const adminWorkItemsAssignmentFilterSchema = z.enum(["mine", "unassigned", "all"]);

export const adminWorkItemsQuerySchema = z.object({
  domain: adminWorkItemDomainSchema.optional(),
  assignment: adminWorkItemsAssignmentFilterSchema.optional().default("all"),
  urgentOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().optional(),
});

export const adminWorkItemsResponseSchema = z.object({
  items: z.array(adminWorkItemSchema),
  nextCursor: z.string().nullable(),
  counts: z.object({
    total: z.number().int().nonnegative(),
    urgent: z.number().int().nonnegative(),
    byDomain: z.record(adminWorkItemDomainSchema, z.number().int().nonnegative()),
  }),
});

export type AdminWorkItemKindDto = z.infer<typeof adminWorkItemKindSchema>;
export type AdminWorkItemDomainDto = z.infer<typeof adminWorkItemDomainSchema>;
export type AdminWorkItemSeverityDto = z.infer<typeof adminWorkItemSeveritySchema>;
export type AdminWorkItemActionDto = z.infer<typeof adminWorkItemActionSchema>;
export type AdminWorkItemDto = z.infer<typeof adminWorkItemSchema>;
export type AdminWorkItemsQuery = z.infer<typeof adminWorkItemsQuerySchema>;
export type AdminWorkItemsResponseDto = z.infer<typeof adminWorkItemsResponseSchema>;
