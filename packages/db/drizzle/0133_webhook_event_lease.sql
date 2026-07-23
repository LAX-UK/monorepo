ALTER TABLE "webhook_event"
  ADD COLUMN IF NOT EXISTS "claim_expires_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "webhook_event_unprocessed_drain_idx"
  ON "webhook_event" USING btree ("received_at")
  WHERE "processed_at" IS NULL;
