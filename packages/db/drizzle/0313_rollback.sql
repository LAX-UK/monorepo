-- Rollback for 0313_lax_art_draft_from_register. Roll back the application release first.
-- History is append-only, so lax_art_draft_created rows cannot be removed: this refuses while any
-- exist, and the wider check and the index stay.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register_event" WHERE "type" = 'lax_art_draft_created') THEN
    RAISE EXCEPTION 'artwork_register_event holds lax_art_draft_created rows; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed'
  )
);

DROP INDEX IF EXISTS "shop_artwork_zoho_product_uid";
