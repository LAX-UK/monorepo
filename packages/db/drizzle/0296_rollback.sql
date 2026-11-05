-- Rollback for 0296_artwork_register_move_event. Roll back the application release first.
-- History is append-only, so move_confirmed rows cannot be removed: this refuses while any exist,
-- and the wider check stays.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register_event" WHERE "type" = 'move_confirmed') THEN
    RAISE EXCEPTION 'artwork_register_event holds move_confirmed rows; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded'
  )
);

DROP INDEX IF EXISTS "lot_artwork_register_open_uid";
