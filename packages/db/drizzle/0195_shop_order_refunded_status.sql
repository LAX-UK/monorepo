SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TYPE "shop_order_status" ADD VALUE IF NOT EXISTS 'partially_refunded';
--> statement-breakpoint
ALTER TYPE "shop_order_status" ADD VALUE IF NOT EXISTS 'refunded';
