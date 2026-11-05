import { PURCHASE_PROBLEM_NOTE_MAX, PURCHASE_PROBLEM_STATUSES } from "@auction/domain";
import { z } from "zod";

export const purchaseProblemIdParamSchema = z.object({ id: z.string().uuid() });

/** One page of the list. `assignee` is a staff id, or "unassigned". */
export const adminPurchaseProblemListQuerySchema = z.object({
  status: z.enum(PURCHASE_PROBLEM_STATUSES).default("open"),
  saleId: z.string().uuid().optional(),
  assignee: z.string().trim().min(1).max(100).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminPurchaseProblemListQuery = z.infer<typeof adminPurchaseProblemListQuerySchema>;

/**
 * One change to a report. `version` is the version the person was looking at. Resolving needs a
 * note; the API refuses it otherwise.
 */
export const adminPurchaseProblemPatchSchema = z
  .object({
    version: z.number().int().min(1),
    assignedToUserId: z.string().trim().min(1).max(100).nullable().optional(),
    status: z.enum(PURCHASE_PROBLEM_STATUSES).optional(),
    note: z.string().trim().min(1).max(PURCHASE_PROBLEM_NOTE_MAX).optional(),
  })
  .refine(
    (patch) =>
      patch.assignedToUserId !== undefined ||
      patch.status !== undefined ||
      patch.note !== undefined,
    { message: "Nothing to change" },
  );
export type AdminPurchaseProblemPatch = z.infer<typeof adminPurchaseProblemPatchSchema>;
