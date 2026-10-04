SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger" DROP CONSTRAINT IF EXISTS "shop_payout_ledger_order_line_id_shop_order_line_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_payout_ledger_order_line_uid";
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger" ALTER COLUMN "order_line_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD COLUMN IF NOT EXISTS "third_party_sale_id" uuid REFERENCES "shop_third_party_sale"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD COLUMN IF NOT EXISTS "original_sale_id" uuid REFERENCES "shop_original_sale"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD CONSTRAINT "shop_payout_ledger_source_fk_check" CHECK (
    ("source" = 'order_line' AND "order_line_id" IS NOT NULL AND "third_party_sale_id" IS NULL AND "original_sale_id" IS NULL)
    OR ("source" = 'third_party_sale' AND "third_party_sale_id" IS NOT NULL AND "order_line_id" IS NULL AND "original_sale_id" IS NULL)
    OR ("source" = 'original_sale' AND "original_sale_id" IS NOT NULL AND "order_line_id" IS NULL AND "third_party_sale_id" IS NULL)
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger" VALIDATE CONSTRAINT "shop_payout_ledger_source_fk_check";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payout_ledger_order_line_uid"
  ON "shop_payout_ledger" ("order_line_id")
  WHERE "order_line_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payout_ledger_third_party_sale_uid"
  ON "shop_payout_ledger" ("third_party_sale_id")
  WHERE "third_party_sale_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_payout_ledger_original_sale_uid"
  ON "shop_payout_ledger" ("original_sale_id")
  WHERE "original_sale_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "shop_payout_ledger"
  ADD CONSTRAINT "shop_payout_ledger_order_line_id_shop_order_line_id_fk"
  FOREIGN KEY ("order_line_id") REFERENCES "shop_order_line"("id") ON DELETE RESTRICT;
