-- IRREVERSIBLE: drops shop product/variant tables and merchandise line columns; historical order data may reference removed product rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "shop_basket_line" WHERE "product_variant_id" IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM "shop_order_line" WHERE "product_variant_id" IS NOT NULL
  ) THEN
    RAISE EXCEPTION '0185 rollback blocked: merchandise basket/order lines exist; archive or delete them first';
  END IF;
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_document";
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  DROP COLUMN IF EXISTS "lax_acted_as_agent",
  DROP COLUMN IF EXISTS "seller_acquisition_source",
  DROP COLUMN IF EXISTS "seller_acquired_at",
  DROP COLUMN IF EXISTS "arr_applicable",
  DROP COLUMN IF EXISTS "version",
  DROP COLUMN IF EXISTS "paid_by_subject_id",
  DROP COLUMN IF EXISTS "paid_reference",
  DROP COLUMN IF EXISTS "paid_at",
  DROP COLUMN IF EXISTS "blocked_reason",
  DROP COLUMN IF EXISTS "cancellation_period_ends_at",
  DROP COLUMN IF EXISTS "funds_available_at",
  DROP COLUMN IF EXISTS "payee_kind",
  DROP COLUMN IF EXISTS "source";
--> statement-breakpoint
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_target_xor";
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  DROP COLUMN IF EXISTS "vat_pence",
  DROP COLUMN IF EXISTS "vat_rate_bp",
  DROP COLUMN IF EXISTS "vat_treatment",
  DROP COLUMN IF EXISTS "product_variant_id";
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "edition_number" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "seller_party_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "artwork_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line" ALTER COLUMN "edition_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "delivery_phone", DROP COLUMN IF EXISTS "delivery_recipient_name";
--> statement-breakpoint
ALTER TABLE "shop_basket_line" DROP CONSTRAINT IF EXISTS "shop_basket_line_target_xor";
--> statement-breakpoint
ALTER TABLE "shop_basket_line" DROP COLUMN IF EXISTS "product_variant_id";
--> statement-breakpoint
ALTER TABLE "shop_basket_line" ALTER COLUMN "artwork_id" SET NOT NULL;
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_product_variant";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_product";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_payee_kind";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_payout_ledger_source";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_document_visibility";
--> statement-breakpoint
DROP TYPE IF EXISTS "shop_document_kind";
