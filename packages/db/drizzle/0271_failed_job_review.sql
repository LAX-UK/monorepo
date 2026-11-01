-- Failed jobs screen: when a job first failed, and who discarded it and why.
--   first_failed_at: the first time the job ran out of attempts (failed_at keeps the latest).
--   discarded_*: a discard is a decision, so it keeps the person, the reason code and a note.
--   A discarded job can be restored while its payload is kept.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD COLUMN IF NOT EXISTS "first_failed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "failed_jobs" SET "first_failed_at" = "failed_at" WHERE "first_failed_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "failed_jobs" ALTER COLUMN "first_failed_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "failed_jobs" ALTER COLUMN "first_failed_at" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD COLUMN IF NOT EXISTS "discarded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD COLUMN IF NOT EXISTS "discarded_by" text;
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD COLUMN IF NOT EXISTS "discard_reason" text;
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD COLUMN IF NOT EXISTS "discard_note" text;
--> statement-breakpoint
ALTER TABLE "failed_jobs" DROP CONSTRAINT IF EXISTS "failed_jobs_discard_complete";
--> statement-breakpoint
ALTER TABLE "failed_jobs" ADD CONSTRAINT "failed_jobs_discard_complete" CHECK (
  ("discarded_at" IS NULL) = ("discard_reason" IS NULL)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "failed_jobs_failed_at_idx" ON "failed_jobs" ("failed_at" DESC);
