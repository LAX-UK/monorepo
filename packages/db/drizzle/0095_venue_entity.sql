DO $$ BEGIN
  CREATE TYPE "venue_status" AS ENUM ('active', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "venue" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "name" text NOT NULL,
  "slug" text,
  "address_line1" text NOT NULL,
  "address_line2" text,
  "city" text NOT NULL,
  "county" text,
  "postcode" text NOT NULL,
  "country" text NOT NULL,
  "map_url" text,
  "latitude" numeric(10, 7),
  "longitude" numeric(10, 7),
  "opening_hours" jsonb,
  "contact_phone" text,
  "contact_email" text,
  "website" text,
  "photos" text[] DEFAULT '{}'::text[] NOT NULL,
  "capacity" integer,
  "access_notes" text,
  "parking_notes" text,
  "directions_notes" text,
  "status" "venue_status" DEFAULT 'active' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  "deleted_by_user_id" text,
  CONSTRAINT "venue_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action,
  CONSTRAINT "venue_deleted_by_user_id_user_id_fk"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
  CONSTRAINT "venue_latitude_range"
    CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  CONSTRAINT "venue_longitude_range"
    CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180))
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "venue_legal_entity_id_idx" ON "venue" ("legal_entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_status_idx" ON "venue" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venue_not_deleted_idx" ON "venue" ("id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "venue_legal_entity_slug_uidx" ON "venue" ("legal_entity_id", "slug") WHERE "slug" IS NOT NULL AND "deleted_at" IS NULL;--> statement-breakpoint

ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "venue_id" uuid;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "sale"
    ADD CONSTRAINT "sale_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sale_venue_id_idx" ON "sale" ("venue_id");
--> statement-breakpoint

WITH lax_entity AS (
  SELECT "id"
  FROM "legal_entity"
  WHERE "is_lax_managed" = true
    AND "subkind" = 'lax_stock'
  ORDER BY "created_at" ASC
  LIMIT 1
), inserted_venue AS (
  INSERT INTO "venue" (
    "legal_entity_id",
    "name",
    "slug",
    "address_line1",
    "address_line2",
    "city",
    "county",
    "postcode",
    "country",
    "map_url"
  )
  SELECT
    "id",
    'LAX Mayfair Saleroom',
    'lax-mayfair-saleroom',
    '12 King Street',
    'St James''s',
    'London',
    null,
    'SW1Y 6QU',
    'United Kingdom',
    'https://www.google.com/maps/search/?api=1&query=12%20King%20Street%2C%20St%20James%27s%2C%20London%20SW1Y%206QU'
  FROM lax_entity
  ON CONFLICT DO NOTHING
  RETURNING "id", "legal_entity_id"
), lax_venue AS (
  SELECT "id", "legal_entity_id" FROM inserted_venue
  UNION ALL
  SELECT v."id", v."legal_entity_id"
  FROM "venue" v
  JOIN lax_entity le ON le."id" = v."legal_entity_id"
  WHERE v."slug" = 'lax-mayfair-saleroom'
  LIMIT 1
)
UPDATE "sale" s
SET "venue_id" = lv."id"
FROM lax_venue lv
WHERE s."venue_id" IS NULL
  AND s."delivery_mode" = 'onsite'
  AND s."created_by_legal_entity_id" = lv."legal_entity_id"
  AND (
    s."location_name" ILIKE '%LAX%'
    OR s."location_address" ILIKE '%SW1Y 6QU%'
    OR s."location_postcode" = 'SW1Y 6QU'
  );
