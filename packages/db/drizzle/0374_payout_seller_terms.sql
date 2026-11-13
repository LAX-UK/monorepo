-- Seller payouts are paid from the seller-terms snapshot: the hammer, less the signed agreement's
-- commission and the VAT on it. Each sale line points at the snapshot it pays, so the payout, the
-- statement and the accounts read one set of figures. A payout keeps the hammer, commission and
-- VAT totals of the sales on it beside its existing totals, which keep their meaning: gross is the
-- hammer total for new payouts and platform_fee is commission plus VAT. A refund line keeps the
-- buyer's refund it answers for, because the seller is charged back only their share of it.
-- Additive: nullable columns that nothing reads until the new release is running.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "payout_line"
  ADD COLUMN IF NOT EXISTS "seller_terms_id" uuid,
  ADD COLUMN IF NOT EXISTS "buyer_refund_pence" bigint;
--> statement-breakpoint
ALTER TABLE "payout"
  ADD COLUMN IF NOT EXISTS "hammer_amount" numeric(18, 2),
  ADD COLUMN IF NOT EXISTS "commission_amount" numeric(18, 2),
  ADD COLUMN IF NOT EXISTS "commission_vat_amount" numeric(18, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_seller_terms_id_fkey') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_seller_terms_id_fkey"
      FOREIGN KEY ("seller_terms_id") REFERENCES "sale_seller_terms"("id") ON DELETE RESTRICT;
  END IF;
  -- Only a lot's sale line pays a snapshot.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_seller_terms_sale_ck') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_seller_terms_sale_ck" CHECK (
        "seller_terms_id" IS NULL OR ("kind" = 'sale' AND "payment_id" IS NOT NULL)
      );
  END IF;
  -- Only a refund line answers for a buyer's refund, and never for a negative one.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_buyer_refund_ck') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_buyer_refund_ck" CHECK (
        "buyer_refund_pence" IS NULL OR ("kind" = 'refund' AND "buyer_refund_pence" >= 0)
      );
  END IF;
  -- The three seller-terms totals are written together, and never below zero.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_seller_terms_totals_ck') THEN
    ALTER TABLE "payout"
      ADD CONSTRAINT "payout_seller_terms_totals_ck" CHECK (
        ("hammer_amount" IS NULL AND "commission_amount" IS NULL AND "commission_vat_amount" IS NULL)
        OR (
          "hammer_amount" IS NOT NULL AND "commission_amount" IS NOT NULL
          AND "commission_vat_amount" IS NOT NULL
          AND "hammer_amount" >= 0 AND "commission_amount" >= 0 AND "commission_vat_amount" >= 0
        )
      );
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_line_seller_terms_idx"
  ON "payout_line" ("seller_terms_id") WHERE "seller_terms_id" IS NOT NULL;
