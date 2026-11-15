-- Zoho is the source of truth for a sale made in the gallery: when a Product's Status becomes Sold,
-- the register records the artwork as sold in the gallery, and an Administrator can reopen one
-- recorded by mistake. History gains the two event types. A "Zoho says Sold" item raised while the
-- artwork was on lax.art stays open after the sale is recorded, so money stays paused, until staff
-- close it: the resolution gains 'staff_resolved'. Widens two CHECKs only; existing rows satisfy them.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked',
    'sold_while_live_raised', 'sold_while_live_resolved', 'sold_while_live_overridden',
    'gallery_sale_recorded', 'gallery_sale_reopened'
  )
);
--> statement-breakpoint
ALTER TABLE "artwork_register_sold_attention"
  DROP CONSTRAINT IF EXISTS "artwork_register_sold_attention_resolution_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_sold_attention" ADD CONSTRAINT "artwork_register_sold_attention_resolution_check"
  CHECK ("resolution" IS NULL OR "resolution" IN
    ('zoho_status_changed', 'withdrawn', 'sold_in_lax', 'replaced', 'staff_override', 'staff_resolved'));
