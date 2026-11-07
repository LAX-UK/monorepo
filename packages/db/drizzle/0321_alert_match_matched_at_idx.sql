-- The alert retention prune removes settled matches older than 90 days, picked by matched_at.
-- Without an index every batch scans the whole match table; with it the prune walks the oldest rows.
-- Plain CREATE INDEX: the migration runner is transactional, so CONCURRENTLY is not available.
-- The build blocks writes to each match table for the few seconds it takes at current table sizes;
-- the lock timeout makes it fail fast, rather than queue behind a long transaction, and it is safe to
-- run again.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_match_matched_at_idx" ON "bid_alert_match" USING btree ("matched_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_match_matched_at_idx" ON "shop_alert_match" USING btree ("matched_at");
