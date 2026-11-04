import { PURCHASE_PROBLEM_CATEGORIES, PURCHASE_PROBLEM_STATUSES } from "@auction/domain";
import { z } from "zod";

/** What the staff Purchase problems routes answer with. Browser-safe: no server-only imports. */
const status = z.enum(PURCHASE_PROBLEM_STATUSES);

const lotSchema = z.object({
  id: z.string(),
  title: z.string(),
  lotNumber: z.number().nullable(),
  saleId: z.string().nullable(),
  saleTitle: z.string().nullable(),
});

export const purchaseProblemListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  status,
  category: z.enum(PURCHASE_PROBLEM_CATEGORIES),
  buyerName: z.string(),
  lot: lotSchema,
  raisedAt: z.string(),
  assignedToUserId: z.string().nullable(),
});
export type PurchaseProblemListItem = z.infer<typeof purchaseProblemListItemSchema>;

export const purchaseProblemListPageSchema = z.object({
  items: z.array(purchaseProblemListItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  counts: z.object({ open: z.number(), in_progress: z.number(), resolved: z.number() }),
  sales: z.array(z.object({ id: z.string(), title: z.string() })),
});
export type PurchaseProblemListPage = z.infer<typeof purchaseProblemListPageSchema>;

export const purchaseProblemNoteSchema = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});
export type PurchaseProblemNote = z.infer<typeof purchaseProblemNoteSchema>;

export const purchaseProblemViewSchema = purchaseProblemListItemSchema.extend({
  message: z.string(),
  version: z.number(),
  payment: z.object({ id: z.string(), status: z.string(), amountMinor: z.number() }),
  resolvedAt: z.string().nullable(),
  resolvedByUserId: z.string().nullable(),
  nextStatuses: z.array(status),
  notes: z.array(purchaseProblemNoteSchema),
});
export type PurchaseProblemView = z.infer<typeof purchaseProblemViewSchema>;

export const purchaseProblemAssigneeSchema = z.object({ id: z.string(), name: z.string() });
export type PurchaseProblemAssignee = z.infer<typeof purchaseProblemAssigneeSchema>;
export const purchaseProblemAssigneesSchema = z.object({
  assignees: z.array(purchaseProblemAssigneeSchema),
});
