CREATE TYPE "shop_edition_listing_status" AS ENUM(
  'not_authorised',
  'authorised',
  'reserved',
  'held',
  'sold',
  'withdrawn'
);
--> statement-breakpoint
CREATE TYPE "shop_edition_custody_status" AS ENUM(
  'unprinted',
  'in_production',
  'qc_failed',
  'stored',
  'in_transit',
  'delivered',
  'collected',
  'with_owner',
  'returned'
);
--> statement-breakpoint
ALTER TABLE "shop_edition"
  ADD COLUMN IF NOT EXISTS "listing_status" "shop_edition_listing_status" DEFAULT 'not_authorised' NOT NULL,
  ADD COLUMN IF NOT EXISTS "custody_status" "shop_edition_custody_status" DEFAULT 'unprinted' NOT NULL,
  ADD COLUMN IF NOT EXISTS "sale_authorised_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "withdrawn_reason" text,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
UPDATE "shop_edition" SET "listing_status" = CASE
  WHEN "status" = 'sold' THEN 'sold'::"shop_edition_listing_status"
  WHEN "status" = 'reserved' THEN 'reserved'::"shop_edition_listing_status"
  WHEN "status" = 'available' AND "allocation" = 'lax' THEN 'authorised'::"shop_edition_listing_status"
  WHEN "status" = 'available' THEN 'authorised'::"shop_edition_listing_status"
  ELSE 'not_authorised'::"shop_edition_listing_status"
END;
--> statement-breakpoint
UPDATE "shop_edition" SET "custody_status" = CASE
  WHEN "status" = 'in_production' THEN 'in_production'::"shop_edition_custody_status"
  WHEN "status" = 'stored' THEN 'stored'::"shop_edition_custody_status"
  WHEN "status" = 'shipped' THEN 'delivered'::"shop_edition_custody_status"
  WHEN "status" = 'returned' THEN 'returned'::"shop_edition_custody_status"
  ELSE 'unprinted'::"shop_edition_custody_status"
END;
--> statement-breakpoint
UPDATE "shop_edition" e
SET "owner_party_id" = ar."party_id"
FROM "shop_artwork" aw
JOIN "shop_artist" ar ON ar."id" = aw."artist_id"
WHERE e."artwork_id" = aw."id"
  AND e."allocation" = 'artist'
  AND e."owner_party_id" IS NULL;
--> statement-breakpoint
UPDATE "shop_edition"
SET "sale_authorised_at" = "created_at"
WHERE "listing_status" = 'authorised';
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "print_price_floor_pence" integer,
  ADD COLUMN IF NOT EXISTS "print_size" text,
  ADD COLUMN IF NOT EXISTS "print_paper" text,
  ADD COLUMN IF NOT EXISTS "print_frame" text,
  ADD COLUMN IF NOT EXISTS "zoho_product_id" text,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_artist"
  ADD COLUMN IF NOT EXISTS "zoho_artist_code" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_zoho_code_uid" ON "shop_artist" ("zoho_artist_code");
--> statement-breakpoint
UPDATE "shop_order"
SET "refund_period_ends_at" = NULL
WHERE "status" = 'paid';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_listing_sellable_idx"
  ON "shop_edition" ("artwork_id", "listing_status", "sale_authorised_at", "edition_number");
