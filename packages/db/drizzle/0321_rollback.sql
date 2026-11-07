-- Rollback for 0321_alert_match_matched_at_idx. The retention prune still works, only slower on a
-- large match table; run it as a dry run (or leave ALERT_RETENTION_PURGE_ENABLED off) while it is gone.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP INDEX IF EXISTS "bid_alert_match_matched_at_idx";
DROP INDEX IF EXISTS "shop_alert_match_matched_at_idx";

COMMIT;
