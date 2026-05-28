import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Audit trail for BullMQ jobs moved to the shared dead-letter queue. */
export const failedJobs = pgTable(
  "failed_jobs",
  {
    id: text("id").primaryKey(),
    originalQueue: text("original_queue").notNull(),
    originalJobId: text("original_job_id"),
    originalJobName: text("original_job_name"),
    /** Full job payload JSON for super_admin DLQ replay (not exposed via list APIs). */
    payloadJson: text("payload_json"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull(),
    failedAt: timestamp("failed_at", { mode: "date", withTimezone: true }).notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    replayedAt: timestamp("replayed_at", { mode: "date", withTimezone: true }),
    replayedBy: text("replayed_by"),
  },
  (table) => [
    index("failed_jobs_original_queue_failed_at_idx").on(table.originalQueue, table.failedAt),
  ],
);
