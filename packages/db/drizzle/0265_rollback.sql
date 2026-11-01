-- Rollback for 0265_consignment_cover_end. Safe at any time: threads still being covered keep
-- their cover with no end date, and an ended cover is not lost (it went back to the specialist).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS "consignment_message_unnotified_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "consignment_thread_cover_end_idx";
--> statement-breakpoint
ALTER TABLE "consignment_thread" DROP COLUMN IF EXISTS "covering_until";
