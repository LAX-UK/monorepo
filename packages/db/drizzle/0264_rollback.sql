-- Rollback for 0264_consignment_inbox. Roll back the application release first: the previous
-- release neither reads these columns nor filters internal notes, so internal notes are removed
-- here rather than shown to clients. Saved replies and the thread history are lost; closed
-- threads become open again.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "consignment_saved_reply";
--> statement-breakpoint
DROP TABLE IF EXISTS "consignment_thread_event";
--> statement-breakpoint
DELETE FROM "consignment_message" WHERE "visibility" = 'internal';
--> statement-breakpoint
ALTER TABLE "consignment_message"
  DROP CONSTRAINT IF EXISTS "consignment_message_internal_staff_check",
  DROP CONSTRAINT IF EXISTS "consignment_message_visibility_check",
  DROP COLUMN IF EXISTS "notified_at",
  DROP COLUMN IF EXISTS "deliver_after",
  DROP COLUMN IF EXISTS "visibility";
--> statement-breakpoint
DROP INDEX IF EXISTS "consignment_thread_covering_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "consignment_thread_closed_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "consignment_thread_waiting_idx";
--> statement-breakpoint
ALTER TABLE "consignment_thread"
  DROP CONSTRAINT IF EXISTS "consignment_thread_covering_user_id_user_id_fk",
  DROP CONSTRAINT IF EXISTS "consignment_thread_closed_by_user_id_user_id_fk",
  DROP COLUMN IF EXISTS "awaiting_since",
  DROP COLUMN IF EXISTS "covering_user_id",
  DROP COLUMN IF EXISTS "closed_by_user_id",
  DROP COLUMN IF EXISTS "closed_at";
