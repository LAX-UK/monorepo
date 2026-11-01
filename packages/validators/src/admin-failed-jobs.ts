import {
  FAILED_JOB_BATCH_MAX,
  FAILED_JOB_DISCARD_REASONS,
  FAILED_JOB_NOTE_MAX,
  FAILED_JOB_VIEW_IDS,
} from "@auction/types";
import { z } from "zod";

const calendarDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const adminFailedJobIdParamSchema = z.object({
  id: z.string().min(1).max(191),
});

/** The failed jobs list: a view, text search, a queue, and the last-failed day range. */
export const adminFailedJobsQuerySchema = z.object({
  view: z.enum(FAILED_JOB_VIEW_IDS).default("needs_review"),
  sort: z.enum(["failed_desc", "failed_asc"]).default("failed_desc"),
  q: z.string().trim().max(100).optional(),
  queue: z.string().trim().min(1).max(80).optional(),
  from: calendarDay.optional(),
  to: calendarDay.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(50_000).default(0),
});
export type AdminFailedJobsQuery = z.infer<typeof adminFailedJobsQuerySchema>;

const jobIds = z.array(z.string().min(1).max(191)).min(1).max(FAILED_JOB_BATCH_MAX);

/** Retry one job or a selection. `confirmRepeat` is the tick that a repeat will not hurt. */
export const adminFailedJobsRetryBodySchema = z.object({
  ids: jobIds,
  confirmRepeat: z.boolean().default(false),
});
export type AdminFailedJobsRetryBody = z.infer<typeof adminFailedJobsRetryBodySchema>;

/** Discard one job or a selection with a reason; "other" needs a note. */
export const adminFailedJobsDiscardBodySchema = z
  .object({
    ids: jobIds,
    reason: z.enum(FAILED_JOB_DISCARD_REASONS),
    note: z.string().trim().max(FAILED_JOB_NOTE_MAX).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.reason === "other" && !body.note) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a note when the reason is other.",
        path: ["note"],
      });
    }
  });
export type AdminFailedJobsDiscardBody = z.infer<typeof adminFailedJobsDiscardBodySchema>;

export const adminFailedJobsRestoreBodySchema = z.object({ ids: jobIds });
export type AdminFailedJobsRestoreBody = z.infer<typeof adminFailedJobsRestoreBodySchema>;
