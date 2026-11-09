-- Rollback for 0334_collection_booking. Roll back the application release first: the previous
-- release neither writes nor reads collection hours, rules or bookings. The rollback stops while
-- any live booking exists, because dropping the tables would silently cancel visits buyers have
-- been promised: cancel them, or move them to email, first. Closed bookings, hours, rules and
-- closures are lost, so export them first if they matter.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "collection_booking" WHERE "status" = 'booked') THEN
    RAISE EXCEPTION 'live collection bookings exist; cancel or reassign them before rolling back 0334';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" DROP CONSTRAINT IF EXISTS "lot_fulfilment_collected_by_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" DROP COLUMN IF EXISTS "collected_by_user_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "collection_booking_lot";
--> statement-breakpoint
DROP TABLE IF EXISTS "collection_booking";
--> statement-breakpoint
DROP TABLE IF EXISTS "collection_exception";
--> statement-breakpoint
DROP TABLE IF EXISTS "collection_weekly_hours";
--> statement-breakpoint
DROP TABLE IF EXISTS "collection_place";
--> statement-breakpoint
DROP SEQUENCE IF EXISTS "collection_booking_reference_seq";
