-- Rollback restores the non-unique hold index only.
-- Data changes in 0193 (fulfilment backfill, payout blocked_reason, LAX grants, edition de-authorisation) are irreversible via rollback.
DROP INDEX IF EXISTS "shop_stock_hold_edition_active_uid";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_stock_hold_edition_active_idx"
  ON "shop_stock_hold" ("edition_id", "status")
  WHERE "status" = 'active';
