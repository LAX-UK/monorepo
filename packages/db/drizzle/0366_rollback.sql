-- Rollback for 0366_zoho_sync_health. Roll back the application release first: the previous
-- release neither reads nor writes either. The health row is written again by the next worker
-- start and the next token refresh.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "zoho_artwork_sync_outcome_product_recorded_idx";
DROP TABLE IF EXISTS "zoho_sync_health";
