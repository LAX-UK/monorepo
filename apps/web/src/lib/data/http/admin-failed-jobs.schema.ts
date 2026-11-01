import type {
  FailedJobBatchResult,
  FailedJobDetail,
  FailedJobList,
  FailedJobSummary,
} from "@auction/types";
import { z } from "zod";

const state = z.enum(["needs_review", "retried", "discarded"]);

const retryAvailability = z.union([
  z.object({ allowed: z.literal(true) }),
  z.object({ allowed: z.literal(false), reason: z.string() }),
]);

export const failedJobSummarySchema: z.ZodType<FailedJobSummary> = z.object({
  id: z.string(),
  queue: z.string(),
  typeLabel: z.string(),
  jobLabel: z.string().nullable(),
  sourceLabel: z.string(),
  errorSummary: z.string(),
  attempts: z.number(),
  firstFailedAt: z.string(),
  lastFailedAt: z.string(),
  state,
  mayRepeat: z.boolean(),
  retry: retryAvailability,
});

export const failedJobListSchema: z.ZodType<FailedJobList> = z.object({
  rows: z.array(failedJobSummarySchema),
  total: z.number(),
  counts: z.object({ needs_review: z.number(), retried: z.number(), discarded: z.number() }),
  queues: z.array(z.object({ id: z.string(), label: z.string(), count: z.number() })),
  actionsEnabled: z.boolean(),
});

export const failedJobDetailSchema: z.ZodType<FailedJobDetail> = failedJobSummarySchema.and(
  z.object({
    retryEffect: z.string(),
    errorMessage: z.string(),
    originalJobId: z.string().nullable(),
    payload: z.array(z.object({ label: z.string(), value: z.string(), masked: z.boolean() })),
    omittedPayloadFields: z.number(),
    discard: z
      .object({
        reasonLabel: z.string(),
        note: z.string().nullable(),
        at: z.string(),
        byName: z.string().nullable(),
      })
      .nullable(),
    history: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(["retried", "discarded", "restored"]),
        at: z.string(),
        actorName: z.string().nullable(),
        detail: z.string().nullable(),
      }),
    ),
  }),
);

export const failedJobBatchResultSchema: z.ZodType<FailedJobBatchResult> = z.object({
  results: z.array(
    z.union([
      z.object({ id: z.string(), ok: z.literal(true) }),
      z.object({ id: z.string(), ok: z.literal(false), error: z.string() }),
    ]),
  ),
});
