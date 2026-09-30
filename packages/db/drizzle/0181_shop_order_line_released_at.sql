ALTER TABLE "shop_order_line"
  ADD COLUMN IF NOT EXISTS "released_at" timestamp with time zone;

UPDATE "shop_order_line" AS ol
SET "released_at" = COALESCE(o."updated_at", o."created_at", now())
FROM "shop_order" AS o
WHERE ol."order_id" = o."id"
  AND ol."released_at" IS NULL
  AND o."status" IN ('cancelled', 'expired', 'payment_failed');

DROP INDEX IF EXISTS "shop_order_line_edition_uid";

CREATE UNIQUE INDEX IF NOT EXISTS "shop_order_line_edition_active_uid"
  ON "shop_order_line" ("edition_id")
  WHERE "released_at" IS NULL;
