CREATE TYPE "shop_original_sale_status" AS ENUM(
  'reserved',
  'deposit_due',
  'invoiced',
  'paid',
  'assigned',
  'cancelled'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_original_sale" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "artwork_id" uuid NOT NULL REFERENCES "shop_artwork"("id") ON DELETE restrict,
  "buyer_party_id" uuid NOT NULL REFERENCES "shop_party"("id") ON DELETE restrict,
  "status" "shop_original_sale_status" DEFAULT 'reserved' NOT NULL,
  "sale_price_pence" integer NOT NULL,
  "vat_treatment" text,
  "vat_rate_bp" integer,
  "vat_pence" integer,
  "reservation_expires_at" timestamp with time zone,
  "stripe_invoice_id" text,
  "recorded_by_subject_id" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_original_sale_price_nonnegative" CHECK ("sale_price_pence" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_original_sale_artwork_idx" ON "shop_original_sale" ("artwork_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_original_sale_buyer_idx" ON "shop_original_sale" ("buyer_party_id");
