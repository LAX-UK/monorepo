-- Rollback for 0271_failed_job_review. Roll back the application release first: the previous
-- release neither reads nor writes these columns. Discard decisions (who, why, when) and the
-- first-failure times are lost; the jobs, their payloads and replay state are untouched.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "failed_jobs_failed_at_idx";
ALTER TABLE "failed_jobs" DROP CONSTRAINT IF EXISTS "failed_jobs_discard_complete";
ALTER TABLE "failed_jobs" DROP COLUMN IF EXISTS "discard_note";
ALTER TABLE "failed_jobs" DROP COLUMN IF EXISTS "discard_reason";
ALTER TABLE "failed_jobs" DROP COLUMN IF EXISTS "discarded_by";
ALTER TABLE "failed_jobs" DROP COLUMN IF EXISTS "discarded_at";
ALTER TABLE "failed_jobs" DROP COLUMN IF EXISTS "first_failed_at";
