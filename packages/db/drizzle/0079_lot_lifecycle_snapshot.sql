CREATE TABLE IF NOT EXISTS "lot_lifecycle_snapshot" (
  "lot_id" uuid PRIMARY KEY NOT NULL REFERENCES "lot"("id") ON DELETE CASCADE,
  "current_status" "lot_status" NOT NULL,
  "last_event_type" text NOT NULL,
  "last_event_at" timestamptz NOT NULL,
  "last_actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "last_sale_id" uuid REFERENCES "sale"("id") ON DELETE SET NULL,
  "last_sale_outcome" text,
  "last_sale_ended_at" timestamptz,
  "returned_to_inventory_at" timestamptz,
  "return_count" integer NOT NULL DEFAULT 0,
  "attached_count" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "lot_snap_last_event_idx"
  ON "lot_lifecycle_snapshot" ("last_event_at" DESC);

CREATE INDEX IF NOT EXISTS "lot_snap_returned_at_idx"
  ON "lot_lifecycle_snapshot" ("returned_to_inventory_at" DESC)
  WHERE "returned_to_inventory_at" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "lot_snap_outcome_idx"
  ON "lot_lifecycle_snapshot" ("last_sale_outcome")
  WHERE "last_sale_outcome" IS NOT NULL;
