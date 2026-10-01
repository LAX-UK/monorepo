CREATE TYPE "shop_document_kind" AS ENUM('certificate', 'purchase_invoice', 'fee_evidence', 'other');
--> statement-breakpoint
CREATE TYPE "shop_document_visibility" AS ENUM('client', 'staff', 'internal');
--> statement-breakpoint
CREATE TYPE "shop_payout_ledger_source" AS ENUM('order_line', 'third_party_sale', 'original_sale');
--> statement-breakpoint
CREATE TYPE "shop_payee_kind" AS ENUM('person', 'artist', 'lax', 'gallery');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_product" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_product_slug_uid" ON "shop_product" ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_product_variant" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "shop_product"("id") ON DELETE restrict,
  "sku" text NOT NULL,
  "price_pence" integer NOT NULL,
  "on_hand" integer DEFAULT 0 NOT NULL,
  "reserved" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_product_variant_stock_nonnegative" CHECK ("on_hand" >= 0),
  CONSTRAINT "shop_product_variant_reserved_nonnegative" CHECK ("reserved" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_product_variant_sku_uid" ON "shop_product_variant" ("sku");
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ALTER COLUMN "artwork_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ADD COLUMN IF NOT EXISTS "product_variant_id" uuid REFERENCES "shop_product_variant"("id") ON DELETE restrict;
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_basket_line_basket_artwork_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_basket_line_basket_artwork_uid"
  ON "shop_basket_line" ("basket_id", "artwork_id")
  WHERE "artwork_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ADD CONSTRAINT "shop_basket_line_target_xor"
  CHECK ((("artwork_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1);
--> statement-breakpoint
ALTER TABLE "shop_order"
  ADD COLUMN IF NOT EXISTS "delivery_recipient_name" text,
  ADD COLUMN IF NOT EXISTS "delivery_phone" text;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "edition_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "artwork_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "seller_party_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "edition_number" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD COLUMN IF NOT EXISTS "product_variant_id" uuid REFERENCES "shop_product_variant"("id") ON DELETE restrict,
  ADD COLUMN IF NOT EXISTS "vat_treatment" text,
  ADD COLUMN IF NOT EXISTS "vat_rate_bp" integer,
  ADD COLUMN IF NOT EXISTS "vat_pence" integer;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ADD CONSTRAINT "shop_order_line_target_xor"
  CHECK ((("edition_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1);
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD COLUMN IF NOT EXISTS "source" "shop_payout_ledger_source" DEFAULT 'order_line' NOT NULL,
  ADD COLUMN IF NOT EXISTS "payee_kind" "shop_payee_kind" DEFAULT 'artist' NOT NULL,
  ADD COLUMN IF NOT EXISTS "funds_available_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cancellation_period_ends_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "blocked_reason" text,
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "paid_reference" text,
  ADD COLUMN IF NOT EXISTS "paid_by_subject_id" text,
  ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS "arr_applicable" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "seller_acquired_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "seller_acquisition_source" text,
  ADD COLUMN IF NOT EXISTS "lax_acted_as_agent" boolean;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_document" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "party_id" uuid REFERENCES "shop_party"("id") ON DELETE set null,
  "kind" "shop_document_kind" NOT NULL,
  "object_key" text NOT NULL,
  "visibility" "shop_document_visibility" DEFAULT 'client' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_document_party_idx" ON "shop_document" ("party_id");
