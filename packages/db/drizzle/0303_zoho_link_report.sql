-- Link lax.art originals to their Zoho records. The register history gains two event types, one
-- for a link and one for an unlink, each recording who and why. A small settings table holds the
-- switch that stops publishing unlinked originals; it starts off, so nothing changes until staff
-- turn it on. Additive: a wider CHECK and a new table.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked'
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_catalogue_setting" (
  "key" text PRIMARY KEY NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text
);
