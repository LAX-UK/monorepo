CREATE TABLE IF NOT EXISTS "failed_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "original_queue" text NOT NULL,
  "original_job_id" text,
  "original_job_name" text,
  "payload_json" text,
  "error_message" text,
  "attempts" integer NOT NULL,
  "failed_at" timestamp with time zone NOT NULL,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" text,
  "replayed_at" timestamp with time zone,
  "replayed_by" text
);

CREATE INDEX IF NOT EXISTS "failed_jobs_original_queue_failed_at_idx"
  ON "failed_jobs" ("original_queue", "failed_at");
