-- Covering a consignment thread can end on a date: the thread then goes back to the specialist.
-- Also indexes the replies still waiting to tell the account, for the sweep that finds any whose
-- delivery job was lost.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "consignment_thread"
  ADD COLUMN IF NOT EXISTS "covering_until" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_cover_end_idx"
  ON "consignment_thread" ("covering_until")
  WHERE "covering_user_id" IS NOT NULL AND "covering_until" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_message_unnotified_idx"
  ON "consignment_message" ("deliver_after")
  WHERE "notified_at" IS NULL AND "deliver_after" IS NOT NULL;
