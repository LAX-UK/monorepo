-- How many times the checkout sweep has left an order alone, so ops can be told when one keeps
-- coming back. Additive: one column with a constant default, which Postgres adds without
-- rewriting the table.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "shop_order" ADD COLUMN IF NOT EXISTS "reaper_deferrals" integer DEFAULT 0 NOT NULL;
