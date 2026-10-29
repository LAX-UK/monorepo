-- Rolls back 0250.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DROP INDEX IF EXISTS shop_refund_order_idx;
--> statement-breakpoint
DROP INDEX IF EXISTS shop_order_status_created_idx;
