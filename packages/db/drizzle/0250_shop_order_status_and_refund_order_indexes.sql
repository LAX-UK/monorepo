-- Staff order lists filter by status and sort by date; refunds are looked up by order.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shop_order_status_created_idx ON shop_order (status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shop_refund_order_idx ON shop_refund (order_id);
