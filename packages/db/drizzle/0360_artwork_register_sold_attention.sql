-- Zoho says an artwork is Sold or Reserved while LAX still has it for sale. One "Needs attention"
-- item per artwork and status; while it is open, new money for the artwork is paused. History gains
-- three event types. Adds a table and widens a CHECK only; existing rows already satisfy it.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked',
    'sold_while_live_raised', 'sold_while_live_resolved', 'sold_while_live_overridden'
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_register_sold_attention" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "register_id" uuid NOT NULL REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "zoho_product_id" text NOT NULL,
  "zoho_status" text NOT NULL,
  "place" text NOT NULL,
  "place_ref_id" text,
  "marked_at" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "resolution" text,
  "resolved_by" text,
  "override_reason" text,
  "raised_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  CONSTRAINT "artwork_register_sold_attention_status_check"
    CHECK ("status" IN ('open', 'overridden', 'resolved')),
  CONSTRAINT "artwork_register_sold_attention_zoho_status_check"
    CHECK ("zoho_status" IN ('Sold', 'Reserved')),
  CONSTRAINT "artwork_register_sold_attention_place_check"
    CHECK ("place" IN ('lax_art', 'bid_sale', 'bid_reoffer', 'private_sale')),
  CONSTRAINT "artwork_register_sold_attention_resolution_check"
    CHECK ("resolution" IS NULL OR "resolution" IN
      ('zoho_status_changed', 'withdrawn', 'replaced', 'staff_override'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_register_sold_attention_live_uid"
  ON "artwork_register_sold_attention" ("register_id", "zoho_status")
  WHERE "status" IN ('open', 'overridden');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_sold_attention_open_idx"
  ON "artwork_register_sold_attention" ("raised_at", "id") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_sold_attention_product_idx"
  ON "artwork_register_sold_attention" ("zoho_product_id") WHERE "status" = 'open';
