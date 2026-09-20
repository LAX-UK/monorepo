ALTER TABLE "shop_edition" ADD COLUMN IF NOT EXISTS "reserved_by_order_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shop_edition" ADD CONSTRAINT "shop_edition_reserved_by_order_id_shop_order_id_fk" FOREIGN KEY ("reserved_by_order_id") REFERENCES "public"."shop_order"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_edition_reserved_by_order_idx" ON "shop_edition" USING btree ("reserved_by_order_id");
--> statement-breakpoint
UPDATE "shop_edition" AS e
SET "reserved_by_order_id" = sub.order_id
FROM (
  SELECT DISTINCT ON (ol.edition_id) ol.edition_id, o.id AS order_id
  FROM "shop_order_line" AS ol
  INNER JOIN "shop_order" AS o ON o.id = ol.order_id
  WHERE o.status = 'pending_payment'
  ORDER BY ol.edition_id, o.created_at DESC
) AS sub
WHERE e.id = sub.edition_id
  AND e.status = 'reserved';
