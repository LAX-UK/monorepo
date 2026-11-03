-- Rollback for 0289_artwork_register_writeback_event. Roll back the application release first.
-- History is append-only, so zoho_writeback_recorded rows cannot be removed: this refuses while
-- any exist, and the wider check stays.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register_event" WHERE "type" = 'zoho_writeback_recorded') THEN
    RAISE EXCEPTION 'artwork_register_event holds zoho_writeback_recorded rows; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN ('created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved')
);
