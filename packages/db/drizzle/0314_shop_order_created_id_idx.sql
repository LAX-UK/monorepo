-- The Shop admin order list pages by keyset on (created_at, id), newest first. Without an index
-- on that pair every page sorts the whole table; this lets Postgres walk it backwards.
-- Plain CREATE INDEX: the migration runner is transactional, so CONCURRENTLY is not available.
-- The build blocks writes to shop_order for the few seconds it takes at current table sizes.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_order_created_id_idx" ON "shop_order" USING btree ("created_at","id");
