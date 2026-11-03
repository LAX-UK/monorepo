-- Artwork register: one record per physical artwork, keyed to its Zoho CRM Product and its LAX
-- stock code. Neutral: owned by neither LAX Bid nor Shop, which reach it through the register
-- repository. Three tables:
--   artwork_register           the record. Zoho owns the catalogue fields, LAX owns the offer
--                              state; "version" is the optimistic lock for every write.
--   artwork_register_event     append-only history: moves, Zoho changes applied, conflicts.
--   artwork_register_conflict  a LAX-owned field that Zoho changed: never applied, kept with both
--                              values until staff resolve it. One open conflict per field.
-- Additive: the running release does not read these tables.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_register" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "zoho_product_id" text NOT NULL,
  "stock_code" text NOT NULL,
  "kind" text NOT NULL,
  "source_original_id" uuid REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "title" text NOT NULL,
  "artist_zoho_id" text,
  "artist_name" text NOT NULL,
  "artist_code" text NOT NULL,
  "medium" text,
  "dimensions" text,
  "year" integer,
  "image_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "catalogue_status" text,
  "offer_state" text DEFAULT 'held' NOT NULL,
  "offer_ref_kind" text,
  "offer_ref_id" text,
  "zoho_modified_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artwork_register_kind_check" CHECK ("kind" IN ('original', 'print')),
  CONSTRAINT "artwork_register_stock_code_check" CHECK (
    "stock_code" ~ '^LAX-(ORI|PRI)-[A-Z0-9]{1,6}-[A-Z0-9]{1,6}-[0-9]{2}-[0-9]{4}$'
    AND (("kind" = 'original') = ("stock_code" LIKE 'LAX-ORI-%'))
  ),
  CONSTRAINT "artwork_register_offer_state_check" CHECK (
    "offer_state" IN ('held', 'lax_art', 'bid_sale', 'private_sale', 'sold', 'withdrawn')
  ),
  CONSTRAINT "artwork_register_offer_ref_kind_check" CHECK (
    "offer_ref_kind" IS NULL OR "offer_ref_kind" IN ('shop_artwork', 'bid_lot', 'private_sale')
  ),
  CONSTRAINT "artwork_register_offer_ref_pair_check" CHECK (
    ("offer_ref_kind" IS NULL) = ("offer_ref_id" IS NULL)
  ),
  CONSTRAINT "artwork_register_offer_ref_matches_state_check" CHECK (
    CASE "offer_state"
      WHEN 'lax_art' THEN "offer_ref_kind" IS NOT DISTINCT FROM 'shop_artwork'
      WHEN 'bid_sale' THEN "offer_ref_kind" IS NOT DISTINCT FROM 'bid_lot'
      WHEN 'private_sale' THEN "offer_ref_kind" IS NOT DISTINCT FROM 'private_sale'
      WHEN 'sold' THEN true
      ELSE "offer_ref_kind" IS NULL
    END
  ),
  CONSTRAINT "artwork_register_source_original_check" CHECK (
    "source_original_id" IS NULL OR ("kind" = 'print' AND "source_original_id" <> "id")
  ),
  CONSTRAINT "artwork_register_year_check" CHECK ("year" IS NULL OR "year" BETWEEN 1000 AND 2200),
  CONSTRAINT "artwork_register_image_refs_check" CHECK (jsonb_typeof("image_refs") = 'array'),
  CONSTRAINT "artwork_register_version_check" CHECK ("version" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_register_zoho_product_uid"
  ON "artwork_register" ("zoho_product_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_register_stock_code_uid"
  ON "artwork_register" ("stock_code");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_source_original_idx"
  ON "artwork_register" ("source_original_id") WHERE "source_original_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_offer_state_idx"
  ON "artwork_register" ("offer_state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_offer_ref_idx"
  ON "artwork_register" ("offer_ref_kind", "offer_ref_id") WHERE "offer_ref_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_register_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "register_id" uuid NOT NULL REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "type" text NOT NULL,
  "actor" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artwork_register_event_type_check" CHECK (
    "type" IN ('created', 'offer_moved', 'zoho_change_applied', 'conflict_recorded', 'conflict_resolved')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_event_register_idx"
  ON "artwork_register_event" ("register_id", "created_at", "id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION artwork_register_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'artwork_register_event is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "artwork_register_event_append_only" ON "artwork_register_event";
--> statement-breakpoint
CREATE TRIGGER "artwork_register_event_append_only"
  BEFORE UPDATE OR DELETE ON "artwork_register_event"
  FOR EACH ROW EXECUTE FUNCTION artwork_register_event_append_only();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "artwork_register_conflict" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "register_id" uuid NOT NULL REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  "field" text NOT NULL,
  "zoho_value" jsonb,
  "lax_value" jsonb,
  "status" text DEFAULT 'open' NOT NULL,
  "resolution" text,
  "resolved_by" text,
  "resolved_at" timestamp with time zone,
  "zoho_modified_at" timestamp with time zone NOT NULL,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "artwork_register_conflict_field_check" CHECK (
    "field" IN ('stockCode', 'kind', 'sourceOriginalId', 'offerState')
  ),
  CONSTRAINT "artwork_register_conflict_status_check" CHECK ("status" IN ('open', 'resolved')),
  CONSTRAINT "artwork_register_conflict_resolution_check" CHECK (
    "resolution" IS NULL OR "resolution" IN ('kept_lax', 'accepted_zoho')
  ),
  CONSTRAINT "artwork_register_conflict_resolved_check" CHECK (
    ("status" = 'open' AND "resolution" IS NULL AND "resolved_by" IS NULL AND "resolved_at" IS NULL)
    OR ("status" = 'resolved' AND "resolution" IS NOT NULL AND "resolved_by" IS NOT NULL AND "resolved_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "artwork_register_conflict_open_uid"
  ON "artwork_register_conflict" ("register_id", "field") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_conflict_open_queue_idx"
  ON "artwork_register_conflict" ("detected_at", "id") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_conflict_register_idx"
  ON "artwork_register_conflict" ("register_id");
