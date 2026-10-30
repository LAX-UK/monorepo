-- Rolls back 0253. Guest orders keep their `guest:` owner, so roll back only before any exist.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_projection_cursor";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_guest_order_link";
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_order_guest_customer_idx";
--> statement-breakpoint
ALTER TABLE "shop_order" DROP COLUMN IF EXISTS "guest_customer_id";
--> statement-breakpoint
DROP TABLE IF EXISTS "shop_guest_customer";
