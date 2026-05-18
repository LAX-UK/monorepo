ALTER TABLE "marketing_event_outbox" ADD COLUMN IF NOT EXISTS "claimed_at" timestamptz;
