-- A lot handed over at the collection desk remembers the fulfilment status it was in, so an undo
-- restores exactly that status (released, or ready for collection) rather than always one of them.
-- Additive and nullable: existing rows and every other path are unchanged.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "collection_booking_lot" ADD COLUMN IF NOT EXISTS "previous_fulfilment_status" text;
