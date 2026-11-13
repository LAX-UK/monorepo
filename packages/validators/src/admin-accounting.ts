import { ACCOUNTING_ORGANISATIONS, ACCOUNTING_QUEUE_TABS } from "@auction/types";
import { z } from "zod";

/** Finance › Accounting: one tab, one company or both, a page of documents. */
export const adminAccountingQueueQuerySchema = z.object({
  tab: z.enum(ACCOUNTING_QUEUE_TABS).default("needs_person"),
  organisation: z.enum(ACCOUNTING_ORGANISATIONS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
});
export type AdminAccountingQueueQuery = z.infer<typeof adminAccountingQueueQuerySchema>;

export const adminAccountingDocumentIdParamSchema = z.object({
  id: z.string().uuid(),
});
