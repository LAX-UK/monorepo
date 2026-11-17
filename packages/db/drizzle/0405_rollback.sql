-- Rollback for 0405_shop_alert_send_log. Roll the release back first: the previous release neither
-- reads nor writes these columns or the index. Dropping them forgets the kept send-log counts, the
-- recorded publisher and each announcement's kind; the send log is not on any screen yet. Also
-- removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "shop_alert_match_item_key_idx";
ALTER TABLE "shop_alert_announcement" DROP CONSTRAINT IF EXISTS "shop_alert_announcement_counts_check";
ALTER TABLE "shop_alert_announcement" DROP CONSTRAINT IF EXISTS "shop_alert_announcement_kind_check";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "dropped_reasons";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "dropped_count";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "emailed_count";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "matched_count";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "announced_by";
ALTER TABLE "shop_alert_announcement" DROP COLUMN IF EXISTS "kind";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813233600000;

COMMIT;
