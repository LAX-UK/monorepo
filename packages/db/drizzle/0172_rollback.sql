DROP INDEX IF EXISTS "shop_edition_reserved_by_order_idx";
--> statement-breakpoint
ALTER TABLE "shop_edition" DROP CONSTRAINT IF EXISTS "shop_edition_reserved_by_order_id_shop_order_id_fk";
--> statement-breakpoint
ALTER TABLE "shop_edition" DROP COLUMN IF EXISTS "reserved_by_order_id";
