-- Moving an original between lax.art and LAX Bid. The register history gains one event type: the
-- move was confirmed by a named person (with the consignor's agreement when it is to auction).
-- Widens a CHECK only; existing rows already satisfy it. Then one open lot per artwork.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register_event" DROP CONSTRAINT IF EXISTS "artwork_register_event_type_check";
--> statement-breakpoint
ALTER TABLE "artwork_register_event" ADD CONSTRAINT "artwork_register_event_type_check" CHECK (
  "type" IN (
    'created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved',
    'zoho_writeback_recorded', 'move_confirmed'
  )
);
--> statement-breakpoint
-- One open lot per artwork: a draft, scheduled or live lot holds the artwork's place in LAX Bid, so
-- a second one for the same record is refused. This also makes creating the draft lot for a move
-- safe to repeat. Lots that ended, were withdrawn or deleted do not count.
CREATE UNIQUE INDEX IF NOT EXISTS "lot_artwork_register_open_uid"
  ON "lot" ("artwork_register_id")
  WHERE "artwork_register_id" IS NOT NULL
    AND "deleted_at" IS NULL
    AND "status" IN ('draft', 'scheduled', 'active');
