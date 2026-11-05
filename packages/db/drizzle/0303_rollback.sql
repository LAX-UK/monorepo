-- Rollback for 0303_zoho_link_report. Roll back the application release first. History is
-- append-only, so link and unlink rows cannot be removed: this refuses while any exist, and the
-- wider check stays. The settings table only holds the publish switch and is dropped.
SET LOCAL lock_timeout = '30s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "artwork_register_event"
    WHERE "type" IN ('zoho_link_linked', 'zoho_link_unlinked')
  ) THEN
    RAISE EXCEPTION 'artwork_register_event holds link rows; keep the wider check';
  END IF;
END $$;

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created'
  )
);

DROP TABLE IF EXISTS "shop_catalogue_setting";
