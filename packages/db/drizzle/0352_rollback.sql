-- Rollback for 0352_artwork_register_sold_attention. Roll back the application release first.
-- History is append-only, so sold_while_live_* events cannot be removed: this refuses while any
-- exist, and the wider check stays.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "artwork_register_event" WHERE "type" LIKE 'sold_while_live_%') THEN
    RAISE EXCEPTION 'artwork_register_event holds sold_while_live_* rows; keep the wider check';
  END IF;
END $$;

DROP TABLE IF EXISTS "artwork_register_sold_attention";

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked'
  )
);
