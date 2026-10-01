CREATE INDEX IF NOT EXISTS "shop_payout_ledger_status_due_idx"
  ON "shop_payout_ledger" ("status", "payout_due_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_fulfilment_possession_idx"
  ON "shop_fulfilment" ("possession_at")
  WHERE "possession_at" IS NOT NULL;
--> statement-breakpoint
UPDATE "shop_order"
SET "refund_period_ends_at" = NULL
WHERE "status" = 'paid'
  AND "refund_period_ends_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "shop_fulfilment" f WHERE f."order_id" = "shop_order"."id" AND f."possession_at" IS NOT NULL
  );
