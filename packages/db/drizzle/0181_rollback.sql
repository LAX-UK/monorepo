DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM shop_order_line
    GROUP BY edition_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      '0181 rollback blocked: at least one edition_id has multiple order lines (resold editions). Keep migration 0181 or reconcile data first.';
  END IF;
END $$;

DROP INDEX IF EXISTS "shop_order_line_edition_active_uid";

CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_line_edition_uid"
  ON "shop_order_line" ("edition_id");

ALTER TABLE "shop_order_line"
  DROP COLUMN IF EXISTS "released_at";
