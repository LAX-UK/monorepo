-- A buyer's delivery quote request for a Shop order going outside the UK. The order holds the
-- prints; this row carries the quote through the saleroom's steps (requested, quoted, accepted,
-- withdrawn) and says why a withdrawn one ended. Additive: one new table nothing else reads yet,
-- so running services keep working and checkout for the UK is untouched.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_delivery_quote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "shop_order"("id") ON DELETE RESTRICT,
  "status" text DEFAULT 'requested' NOT NULL,
  "region_id" text,
  "destination_country" text NOT NULL,
  "hold_until" timestamp with time zone NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "quoted_price_pence" integer,
  "quoted_service" text,
  "quoted_lead_time_note" text,
  "quoted_at" timestamp with time zone,
  "quoted_by_subject_id" text,
  "decided_at" timestamp with time zone,
  "end_reason" text,
  "guest_ip_hash" text,
  "basket_token_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_delivery_quote_status_check" CHECK ("status" IN ('requested', 'quoted', 'accepted', 'withdrawn')),
  CONSTRAINT "shop_delivery_quote_region_known" CHECK ("region_id" IS NULL OR "region_id" IN ('eu', 'north_america', 'asia_pacific')),
  CONSTRAINT "shop_delivery_quote_country_code" CHECK ("destination_country" ~ '^[A-Z]{2}$'),
  CONSTRAINT "shop_delivery_quote_end_reason_check" CHECK (("status" = 'withdrawn') = ("end_reason" IS NOT NULL) AND ("end_reason" IS NULL OR "end_reason" IN ('cancelled_by_buyer', 'cannot_deliver', 'expired'))),
  CONSTRAINT "shop_delivery_quote_price_check" CHECK (("status" NOT IN ('quoted', 'accepted') OR "quoted_price_pence" > 0) AND ("quoted_price_pence" IS NULL OR "quoted_price_pence" BETWEEN 1 AND 10000000))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_delivery_quote_order_uid" ON "shop_delivery_quote" ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_delivery_quote_open_hold_idx" ON "shop_delivery_quote" ("hold_until") WHERE "status" IN ('requested', 'quoted');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_delivery_quote_open_ip_idx" ON "shop_delivery_quote" ("guest_ip_hash") WHERE "status" IN ('requested', 'quoted') AND "guest_ip_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_delivery_quote_open_basket_token_idx" ON "shop_delivery_quote" ("basket_token_hash") WHERE "status" IN ('requested', 'quoted') AND "basket_token_hash" IS NOT NULL;
