-- Offer on lax.art: a lax.art listing made from a register record carries that record's Zoho
-- Product id, and no two listings may carry the same one. The column has existed since the edition
-- work but nothing set it, so there are no duplicates to clear. The register history gains one
-- event type for the draft. Additive: a unique partial index and a wider CHECK.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_zoho_product_uid"
  ON "shop_artwork" ("zoho_product_id")
  WHERE "zoho_product_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created'
  )
);
