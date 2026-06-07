ALTER TABLE "notification"
  ADD COLUMN IF NOT EXISTS "submission_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_submission_id_item_submission_id_fk'
  ) THEN
    ALTER TABLE "notification"
      ADD CONSTRAINT "notification_submission_id_item_submission_id_fk"
      FOREIGN KEY ("submission_id") REFERENCES "item_submission"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "notification_submission_id_idx" ON "notification" ("submission_id");
