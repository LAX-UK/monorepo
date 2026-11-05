-- Rollback for 0303_zoho_listing_sync_run. Roll back the application release first. The table
-- only holds nightly pass summaries, which the next pass writes again.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "zoho_listing_sync_run";
