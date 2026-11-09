-- Rollback for 0342_shop_framing_orders. Roll back the application release first. Framing lines are
-- money records (paid orders, invoices, refunds), so this refuses while any exist: removing them
-- would change what buyers were charged. Once none do, the columns, the framing task table and the
-- original target check go.
BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "shop_order_line" WHERE "kind" = 'framing') THEN
    RAISE EXCEPTION 'shop_order_line holds framing lines; keep this migration';
  END IF;
END $$;

DROP TABLE IF EXISTS "shop_framing_task";
DROP TRIGGER IF EXISTS "shop_order_line_framing_fixed_trg" ON "shop_order_line";
DROP FUNCTION IF EXISTS "shop_order_line_framing_fixed"();
DROP INDEX IF EXISTS "shop_order_line_framing_parent_uid";
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_target_xor";
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_target_xor"
  CHECK ((("edition_id" IS NOT NULL)::int + ("product_variant_id" IS NOT NULL)::int) = 1);
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_framing_option_id_fk";
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_framing_for_line_id_fk";
ALTER TABLE "shop_order_line" DROP CONSTRAINT IF EXISTS "shop_order_line_kind_ck";
ALTER TABLE "shop_order_line"
  DROP COLUMN IF EXISTS "framing_snapshot",
  DROP COLUMN IF EXISTS "framing_option_id",
  DROP COLUMN IF EXISTS "framing_for_line_id",
  DROP COLUMN IF EXISTS "kind";
ALTER TABLE "shop_order" DROP CONSTRAINT IF EXISTS "shop_order_framing_subtotal_nonnegative";
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "framing_subtotal_pence";

COMMIT;
