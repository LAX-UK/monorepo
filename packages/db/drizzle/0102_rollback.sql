DROP INDEX IF EXISTS "notification_submission_id_idx";
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_submission_id_item_submission_id_fk";
ALTER TABLE "notification" DROP COLUMN IF EXISTS "submission_id";
