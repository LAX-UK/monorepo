-- Where LAX Shop delivers: the four regions with lax.bid/shipping's lead times (working days after
-- dispatch), an optional fixed price per region, and the countries it does not deliver to.
-- Additive: two new tables and seed rows, so running services keep working. Nothing reads them
-- yet; checkout still behaves as before. The UK is seeded with the delivery price checkout
-- charges today (1500 pence); the other regions are quoted (no fixed price).
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_delivery_region" (
  "id" text PRIMARY KEY NOT NULL,
  "standard_min_days" integer NOT NULL,
  "standard_max_days" integer NOT NULL,
  "specialist_min_days" integer NOT NULL,
  "specialist_max_days" integer NOT NULL,
  "fixed_price_pence" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_by_subject_id" text,
  CONSTRAINT "shop_delivery_region_id_known" CHECK ("id" IN ('uk', 'eu', 'north_america', 'asia_pacific')),
  CONSTRAINT "shop_delivery_region_standard_days" CHECK ("standard_min_days" BETWEEN 1 AND 120 AND "standard_max_days" BETWEEN "standard_min_days" AND 120),
  CONSTRAINT "shop_delivery_region_specialist_days" CHECK ("specialist_min_days" BETWEEN 1 AND 120 AND "specialist_max_days" BETWEEN "specialist_min_days" AND 120),
  CONSTRAINT "shop_delivery_region_price_range" CHECK ("fixed_price_pence" IS NULL OR "fixed_price_pence" BETWEEN 1 AND 10000000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_delivery_restricted_country" (
  "country_code" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_delivery_restricted_country_code" CHECK ("country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
INSERT INTO "shop_delivery_region"
  ("id", "standard_min_days", "standard_max_days", "specialist_min_days", "specialist_max_days", "fixed_price_pence")
VALUES
  ('uk', 5, 10, 10, 20, 1500),
  ('eu', 10, 15, 15, 25, NULL),
  ('north_america', 12, 18, 18, 30, NULL),
  ('asia_pacific', 14, 21, 21, 35, NULL)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "shop_delivery_restricted_country" ("country_code")
VALUES ('BY'), ('IR'), ('KP'), ('RU'), ('SY')
ON CONFLICT ("country_code") DO NOTHING;
