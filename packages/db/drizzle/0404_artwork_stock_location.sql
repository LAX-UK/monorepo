-- Stock location per artwork (design: docs/design/stock-location.md, register item ZI-6). Where an
-- original physically sits, kept apart from where it is offered (offer_state).
--   artwork_location       the controlled list staff keep in LAX Admin. Names are unique ignoring
--                          case; a location is retired, never deleted, so history keeps reading.
--   artwork_location_move  append-only: one row per move. An artwork's current location is its
--                          latest move; nothing else holds a copy that could drift. No row reads
--                          "Location not recorded".
--   artwork_register_event gains 'location_moved', so the record's history shows each move.
-- Additive: the running release does not read these tables.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_location" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "note" text,
  "status" text DEFAULT 'active' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "retired_at" timestamp with time zone,
  CONSTRAINT "artwork_location_name_check" CHECK (
    char_length("name") BETWEEN 1 AND 80 AND "name" = btrim("name")
  ),
  CONSTRAINT "artwork_location_note_check" CHECK (
    "note" IS NULL OR (char_length("note") BETWEEN 1 AND 200 AND "note" = btrim("note"))
  ),
  CONSTRAINT "artwork_location_status_check" CHECK ("status" IN ('active', 'retired')),
  CONSTRAINT "artwork_location_retired_check" CHECK (("status" = 'retired') = ("retired_at" IS NOT NULL)),
  CONSTRAINT "artwork_location_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_location_name_uid"
  ON "artwork_location" (lower("name"));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_location_move" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "register_id" uuid NOT NULL REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "location_id" uuid NOT NULL REFERENCES "artwork_location"("id") ON DELETE RESTRICT,
  "moved_at" timestamp with time zone NOT NULL,
  "moved_by" text NOT NULL,
  "note" text,
  CONSTRAINT "artwork_location_move_note_check" CHECK (
    "note" IS NULL OR (char_length("note") BETWEEN 1 AND 500 AND "note" = btrim("note"))
  )
);
--> statement-breakpoint
-- The latest move per artwork is its current location; a later move is stamped strictly after.
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_location_move_register_uid"
  ON "artwork_location_move" ("register_id", "moved_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_location_move_location_idx"
  ON "artwork_location_move" ("location_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION artwork_location_move_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'artwork_location_move is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "artwork_location_move_append_only" ON "artwork_location_move";
--> statement-breakpoint
CREATE TRIGGER "artwork_location_move_append_only"
  BEFORE UPDATE OR DELETE ON "artwork_location_move"
  FOR EACH ROW EXECUTE FUNCTION artwork_location_move_append_only();
--> statement-breakpoint
-- The rebuilt check allows every type the previous one did, and that one already held for every
-- row, so it is added NOT VALID: no scan of the history while the table is locked.
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed', 'lax_art_draft_created',
    'zoho_link_linked', 'zoho_link_unlinked',
    'sold_while_live_raised', 'sold_while_live_resolved', 'sold_while_live_overridden',
    'gallery_sale_recorded', 'gallery_sale_reopened',
    'location_moved'
  )
) NOT VALID;
