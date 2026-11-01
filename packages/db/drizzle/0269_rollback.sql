-- Rollback for 0269_lot_extended_until. Safe at any time: lots keep the end time the extension
-- already gave them; only the record that it was an extension is dropped.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "lot" DROP COLUMN IF EXISTS "extended_until";
