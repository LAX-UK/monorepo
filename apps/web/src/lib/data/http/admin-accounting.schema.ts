import {
  ACCOUNTING_DOCUMENT_TYPES,
  ACCOUNTING_ORGANISATIONS,
  ACCOUNTING_PARK_REASONS,
  ACCOUNTING_PRODUCTS,
  ACCOUNTING_QUEUE_TABS,
  type AccountingQueuePage,
  type AccountingQueueRow,
  type AccountingReleaseResult,
  type AccountingTryAgainResult,
} from "@auction/types";
import { z } from "zod";

const tab = z.enum(ACCOUNTING_QUEUE_TABS);
const organisation = z.enum(ACCOUNTING_ORGANISATIONS);
const documentState = z.enum([
  "pending",
  "sending",
  "issued",
  "unknown",
  "needs_review",
  "failed",
  "cancelled",
]);

export const accountingQueueRowSchema: z.ZodType<AccountingQueueRow> = z.object({
  id: z.string(),
  reference: z.string(),
  documentType: z.enum(ACCOUNTING_DOCUMENT_TYPES),
  label: z.string(),
  parked: z.enum(ACCOUNTING_PARK_REASONS).nullable(),
  appliedTo: z.array(z.object({ reference: z.string(), amountPence: z.number().int() })),
  waitingFor: z.array(z.object({ reference: z.string(), state: documentState.nullable() })),
  product: z.enum(ACCOUNTING_PRODUCTS),
  organisation,
  state: documentState,
  targetMode: z.enum(["dry_run", "test_org", "live"]).nullable(),
  grossPence: z.number().int(),
  attempts: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  problem: z.string().nullable(),
  problemCode: z.string().nullable(),
  lockedPeriod: z.boolean(),
  books: z.object({ number: z.string(), id: z.string(), url: z.string().nullable() }).nullable(),
  canTryAgain: z.boolean(),
  canRelease: z.boolean(),
});

export const accountingQueuePageSchema: z.ZodType<AccountingQueuePage> = z.object({
  tab,
  organisation: organisation.nullable(),
  reference: z.string().nullable(),
  rows: z.array(accountingQueueRowSchema),
  total: z.number().int(),
  counts: z.object({
    needs_person: z.number().int(),
    failed: z.number().int(),
    waiting: z.number().int(),
    issued: z.number().int(),
  }),
  issuedToday: z.number().int(),
  lastSent: z.object({ at: z.string(), rehearsal: z.boolean() }).nullable(),
  limit: z.number().int(),
  offset: z.number().int(),
  unreadable: z.number().int(),
  canAct: z.boolean(),
  partFundedTransfers: z.array(
    z.object({
      reference: z.string(),
      paySeveral: z.boolean(),
      buyer: z.string(),
      receivedPence: z.number().int(),
      totalPence: z.number().int(),
      since: z.string().nullable(),
    }),
  ),
  // Absent from an API that predates refunds: read as none waiting.
  unattributedRefunds: z
    .array(
      z.object({
        paymentGroupId: z.string(),
        amountPence: z.number().int(),
        buyerName: z.string(),
        settledAt: z.string().nullable(),
      }),
    )
    .default([]),
}) as z.ZodType<AccountingQueuePage, z.ZodTypeDef, unknown> as z.ZodType<AccountingQueuePage>;

export const accountingTryAgainResultSchema: z.ZodType<AccountingTryAgainResult> = z.object({
  id: z.string(),
  reference: z.string(),
  outcome: z.enum(["requeued", "already_queued"]),
});

export const accountingReleaseResultSchema: z.ZodType<AccountingReleaseResult> = z.object({
  id: z.string(),
  reference: z.string(),
  outcome: z.enum(["released", "already_queued"]),
  rebuilt: z.boolean(),
});
