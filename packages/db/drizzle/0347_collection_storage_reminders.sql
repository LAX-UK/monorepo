-- Storage reminders. A lot records when its payment cleared, so "please collect by" counts from
-- it, and a place records what storage costs after the free period (recorded for Finance only; no
-- charge is raised from it). Both are nullable and unread by anything that predates them, so
-- running services keep working. Lots cleared before this have no date and get no reminder.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" ADD COLUMN IF NOT EXISTS "payment_cleared_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "collection_place" ADD COLUMN IF NOT EXISTS "storage_charge_pence" integer;
--> statement-breakpoint
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_storage_charge_check";
--> statement-breakpoint
ALTER TABLE "collection_place" ADD CONSTRAINT "collection_place_storage_charge_check" CHECK ("storage_charge_pence" IS NULL OR "storage_charge_pence" BETWEEN 0 AND 1000000);
