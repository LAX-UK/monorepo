-- The release-alert send log (design LA-3, L3 and Q10) keeps what it shows on the announcement, so
-- the log stays true after the 90-day match prune and after a subscriber is pruned or erased (both
-- cascade to shop_alert_match):
--   kind             what the work was when it was published (shop_release or art_original). The
--                    log lists shop releases by this, so a release never leaves the log when staff
--                    later change the work's edition flags.
--   announced_by     the LAX Account subject who published it, written in the publishing
--                    transaction, so the log never scans shop_admin_audit.
--   matched_count    shop.releases matches made when the release was expanded.
--   emailed_count    matches in a digest that was sent, counted as each digest is marked sent.
--   dropped_count    matches dropped before sending, counted as each is dropped.
--   dropped_reasons  dropped matches by reason, counted with dropped_count.
-- The counters get their defaults only after the columns exist, so rows from before this migration
-- keep NULL counts: the log says their counts were not kept, instead of passing what is left for
-- the whole send. kind and announced_by are filled once below from the work and its audit row.
-- Deploy overlap: a release announced by the previous build after this backfill has run keeps kind
-- and announced_by NULL. The log reads a NULL kind through the same current-flags rule as the
-- backfill (shop channel and edition-eligible), so it is still listed, with its publisher unknown;
-- no rerun of the backfill is needed.
-- shop_alert_match gains an (item_key, topic) index so the log's per-page live read of waiting and
-- stuck matches is an index lookup. Plain CREATE INDEX: the migration runner is transactional, so
-- CONCURRENTLY is not available; the build briefly blocks writes to the bounded match table, and the
-- lock timeout makes it fail fast. Additive: the running release neither reads nor writes these.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "kind" text;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "announced_by" text;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "matched_count" integer;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "emailed_count" integer;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "dropped_count" integer;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD COLUMN IF NOT EXISTS "dropped_reasons" jsonb;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ALTER COLUMN "emailed_count" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ALTER COLUMN "dropped_count" SET DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ALTER COLUMN "dropped_reasons" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" DROP CONSTRAINT IF EXISTS "shop_alert_announcement_kind_check";
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD CONSTRAINT "shop_alert_announcement_kind_check" CHECK ("kind" IS NULL OR "kind" IN ('shop_release', 'art_original'));
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" DROP CONSTRAINT IF EXISTS "shop_alert_announcement_counts_check";
--> statement-breakpoint
ALTER TABLE "shop_alert_announcement" ADD CONSTRAINT "shop_alert_announcement_counts_check" CHECK (coalesce("matched_count", 0) >= 0 AND coalesce("emailed_count", 0) >= 0 AND coalesce("dropped_count", 0) >= 0);
--> statement-breakpoint
UPDATE "shop_alert_announcement" AS n
   SET "kind" = CASE
     WHEN w."sales_channel" = 'shop' AND w."eligible_for_edition_allocation" THEN 'shop_release'
     WHEN w."sales_channel" = 'art' AND w."source_original_artwork_id" IS NULL THEN 'art_original'
   END
  FROM "shop_artwork" AS w
 WHERE n."item_key" = 'artwork:' || w."id"::text
   AND n."kind" IS NULL;
--> statement-breakpoint
UPDATE "shop_alert_announcement" AS n
   SET "announced_by" = p."actor_subject_id"
  FROM (
    SELECT DISTINCT ON (a."target_id") a."target_id", a."actor_subject_id"
      FROM "shop_admin_audit" AS a
      JOIN "shop_alert_announcement" AS x ON x."item_key" = 'artwork:' || a."target_id"
     WHERE a."target_type" = 'shop_artwork'
       AND a."action" = 'publish_artwork'
       AND a."created_at" <= x."announced_at"
     ORDER BY a."target_id", a."created_at" DESC, a."id" DESC
  ) AS p
 WHERE n."item_key" = 'artwork:' || p."target_id"
   AND n."announced_by" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_match_item_key_idx" ON "shop_alert_match" USING btree ("item_key", "topic");
