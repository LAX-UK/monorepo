-- Rollback for 0404_artwork_stock_location. Roll the release back first: the previous release
-- neither reads nor writes locations. The moves are the only record of where each artwork
-- physically is, so this refuses while any exist (export them first, then delete them as the
-- owner with the trigger disabled). History is append-only, so its location move rows are kept and
-- the event type CHECK is restored NOT VALID (existing rows are not re-checked, new ones are).
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

-- Nested, not AND: the whole condition is planned at once, which fails once the table is gone.
DO $$
BEGIN
  IF to_regclass('public.artwork_location_move') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "artwork_location_move") THEN
      RAISE EXCEPTION 'artwork_location_move holds moves; export them before rolling back';
    END IF;
  END IF;
END $$;

DROP TABLE IF EXISTS "artwork_location_move";
DROP FUNCTION IF EXISTS artwork_location_move_append_only();
DROP TABLE IF EXISTS "artwork_location";

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked',
    'sold_while_live_raised', 'sold_while_live_resolved', 'sold_while_live_overridden',
    'gallery_sale_recorded', 'gallery_sale_reopened'
  )
) NOT VALID;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813147200000;

COMMIT;
