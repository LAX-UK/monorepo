-- Rollback for 0393_zoho_gallery_sale. Roll the release back first: the previous release records
-- no gallery sales and closes no item as staff_resolved. History is append-only, so the new event
-- rows are kept and the event type CHECK is restored NOT VALID (existing rows are not re-checked,
-- new ones are). Items closed as staff_resolved are relabelled 'withdrawn' (the artwork left sale)
-- so the previous resolution CHECK holds. Also removes this migration's ledger row so a later
-- deploy reapplies it.
BEGIN;

ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked',
    'sold_while_live_raised', 'sold_while_live_resolved', 'sold_while_live_overridden'
  )
) NOT VALID;

UPDATE "artwork_register_sold_attention" SET "resolution" = 'withdrawn'
  WHERE "resolution" = 'staff_resolved';
ALTER TABLE "artwork_register_sold_attention"
  DROP CONSTRAINT IF EXISTS "artwork_register_sold_attention_resolution_check";
ALTER TABLE "artwork_register_sold_attention" ADD CONSTRAINT "artwork_register_sold_attention_resolution_check"
  CHECK ("resolution" IS NULL OR "resolution" IN
    ('zoho_status_changed', 'withdrawn', 'sold_in_lax', 'replaced', 'staff_override'));

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812196800000;

COMMIT;
