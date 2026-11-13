import { ACCOUNTING_ORGANISATIONS, ACCOUNTING_QUEUE_TABS } from "@auction/types";
import { z } from "zod";

/**
 * A LAX accounting reference as `laxReference` builds it: `LAX-<PRODUCT>-<KIND>-<source id>`.
 * Trimmed; only the characters a real reference can hold, so the search cannot carry anything else
 * to the query. An empty search clears the filter (handled by the caller, which omits the param).
 */
export const adminAccountingReferenceSchema = z
  .string()
  .trim()
  .min(5)
  .max(128)
  .regex(/^LAX-[A-Za-z0-9-]+$/, "Enter a LAX reference, e.g. LAX-BID-INV-….");

/** Finance › Accounting: one tab, one company or both, an optional reference, a page of documents. */
export const adminAccountingQueueQuerySchema = z.object({
  tab: z.enum(ACCOUNTING_QUEUE_TABS).default("needs_person"),
  organisation: z.enum(ACCOUNTING_ORGANISATIONS).optional(),
  reference: adminAccountingReferenceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
});
export type AdminAccountingQueueQuery = z.infer<typeof adminAccountingQueueQuerySchema>;

export const adminAccountingDocumentIdParamSchema = z.object({
  id: z.string().uuid(),
});
