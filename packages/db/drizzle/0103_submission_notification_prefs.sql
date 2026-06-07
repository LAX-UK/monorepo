ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "submission_updates_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "submission_updates_push" boolean DEFAULT true NOT NULL;
