-- Platform (LAX) seller payouts are never paid to owners; cancel legacy rows (idempotent).
UPDATE "shop_payout_ledger" AS "pl"
SET
  "status" = 'cancelled',
  "blocked_reason" = 'lax_platform_seller'
WHERE "pl"."status" = 'pending_refund_period'
  AND EXISTS (
    SELECT 1
    FROM "shop_order_line" AS "ol"
    INNER JOIN "shop_party" AS "p" ON "p"."id" = "ol"."seller_party_id" AND "p"."kind" = 'lax'
    WHERE "ol"."id" = "pl"."order_line_id"
  );
--> statement-breakpoint
-- Backfill LAX owner on editions missing owner_party_id (deterministic single LAX party).
UPDATE "shop_edition" AS "e"
SET "owner_party_id" = "lax"."id"
FROM (
  SELECT "id"
  FROM "shop_party"
  WHERE "kind" = 'lax'
  ORDER BY "id"
  LIMIT 1
) AS "lax"
WHERE "e"."owner_party_id" IS NULL
  AND "e"."allocation" = 'lax'
  AND "lax"."id" IS NOT NULL;
--> statement-breakpoint
UPDATE "shop_basket_line"
SET "quantity" = 1
WHERE "quantity" < 1;
--> statement-breakpoint
UPDATE "shop_basket_line"
SET "unit_price_pence" = 0
WHERE "unit_price_pence" < 0;
--> statement-breakpoint
UPDATE "shop_order_line"
SET "unit_price_pence" = 0
WHERE "unit_price_pence" < 0;
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_quantity_positive" CHECK ("quantity" > 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "shop_basket_line" VALIDATE CONSTRAINT "shop_basket_line_quantity_positive";
--> statement-breakpoint
ALTER TABLE "shop_basket_line"
  ADD CONSTRAINT "shop_basket_line_price_nonnegative" CHECK ("unit_price_pence" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "shop_basket_line" VALIDATE CONSTRAINT "shop_basket_line_price_nonnegative";
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_price_nonnegative" CHECK ("unit_price_pence" >= 0) NOT VALID;
--> statement-breakpoint
ALTER TABLE "shop_order_line" VALIDATE CONSTRAINT "shop_order_line_price_nonnegative";
