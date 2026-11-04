-- Followed artists and saved searches become Bid alert topics. People who already follow an artist
-- were told "Alerts reach you by email and in the app"; people with a saved search with email on
-- were told the same. Each verified account with either gets a confirmed subscription (or takes
-- over a confirmed visitor sign-up for its own address) and the matching topic switched on.
-- Anyone who has stopped, or who already has a row for the topic, keeps their choice.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
INSERT INTO "bid_alert_subscriber" (
  "product", "email", "user_id", "status", "consent_text", "consent_source",
  "requested_at", "confirmed_at"
)
SELECT
  'bid', lower(btrim(d."email")), d."subject_id", 'confirmed',
  'We''ll email you when a lot comes up for sale by an artist you follow. At most one email a day.',
  'bid_follow_migration', now(), now()
FROM "bid_identity_directory" d
WHERE d."email_verified"
  AND d."merged_into_subject_id" IS NULL
  AND d."deletion_requested_at" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "artist_watchlist" w WHERE w."user_id" = d."subject_id")
    OR EXISTS (SELECT 1 FROM "saved_search" ss WHERE ss."user_id" = d."subject_id" AND ss."notify_email")
  )
  AND NOT EXISTS (SELECT 1 FROM "bid_alert_subscriber" x WHERE x."user_id" = d."subject_id")
ON CONFLICT ("product", "email") DO NOTHING;
--> statement-breakpoint
UPDATE "bid_alert_subscriber" x
SET "user_id" = d."subject_id", "updated_at" = now()
FROM "bid_identity_directory" d
WHERE x."product" = 'bid'
  AND x."user_id" IS NULL
  AND x."status" = 'confirmed'
  AND x."email" = lower(btrim(d."email"))
  AND d."email_verified"
  AND d."merged_into_subject_id" IS NULL
  AND d."deletion_requested_at" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "artist_watchlist" w WHERE w."user_id" = d."subject_id")
    OR EXISTS (SELECT 1 FROM "saved_search" ss WHERE ss."user_id" = d."subject_id" AND ss."notify_email")
  );
--> statement-breakpoint
INSERT INTO "bid_alert_topic" ("subscriber_id", "topic", "email_on", "changed_at", "changed_by")
SELECT x."id", 'bid.artists', true, now(), 'migration'
FROM "bid_alert_subscriber" x
WHERE x."status" = 'confirmed'
  AND x."user_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "artist_watchlist" w WHERE w."user_id" = x."user_id")
ON CONFLICT ("subscriber_id", "topic") DO NOTHING;
--> statement-breakpoint
INSERT INTO "bid_alert_topic" ("subscriber_id", "topic", "email_on", "changed_at", "changed_by")
SELECT x."id", 'bid.searches', true, now(), 'migration'
FROM "bid_alert_subscriber" x
WHERE x."status" = 'confirmed'
  AND x."user_id" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "saved_search" ss WHERE ss."user_id" = x."user_id" AND ss."notify_email")
ON CONFLICT ("subscriber_id", "topic") DO NOTHING;
--> statement-breakpoint
-- Lot matching starts here: lots published before this migration are never announced, and every
-- lot published after it is, however long the worker takes to get to it.
INSERT INTO "projector_state" ("projector_name", "last_processed_event_id")
SELECT 'bid_alert_lot_matching_start', COALESCE(max("id"), 0) FROM "domain_events"
ON CONFLICT ("projector_name") DO NOTHING;
--> statement-breakpoint
-- A lot reaches a person once, whichever topic matched it, even across batches and runs.
CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_match_lot_once_uid"
  ON "bid_alert_match" ("subscriber_id", "item_key") WHERE "item_key" LIKE 'lot:%';
