-- Alert engine, LAX Shop and lax.art side.
--   shop_alert_subscriber / _topic / _match / _digest / _announcement: the same table shape as
--     Bid's bid_alert_* tables, owned by shop-api. One set holds both products (shop, art). A
--     digest is unique per person, product and London day (the frequency cap); a match is unique
--     per person, topic and item; an announcement is unique per item, so an edition or original
--     is announced once however often it is published.
--   The Shop release-alert list (0276) moves across with the same ids, states and consent
--     records, so links already sent keep working and nobody is asked to confirm again. The stored
--     plain stop token is kept only as a SHA-256 hash in legacy_link_hash, which the stop route
--     resolves. The old table is left in place, unread; a later migration drops it with its
--     plain token column.
--   Every edition and original already on sale is recorded as announced, so switching alerts on
--     tells nobody about work that was published before.
-- Additive: the running release keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_alert_subscriber" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product" text NOT NULL,
  "email" text NOT NULL,
  "identity_subject_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "consent_text" text NOT NULL,
  "consent_source" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL,
  "confirmation_sent_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "stopped_at" timestamp with time zone,
  "stop_reason" text,
  "link_version" integer DEFAULT 1 NOT NULL,
  "legacy_link_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_alert_subscriber_product_check" CHECK ("product" IN ('shop', 'art')),
  CONSTRAINT "shop_alert_subscriber_status_check" CHECK ("status" IN ('pending', 'confirmed', 'stopped')),
  CONSTRAINT "shop_alert_subscriber_stop_reason_check" CHECK (
    "stop_reason" IS NULL OR "stop_reason" IN ('link', 'one_click', 'settings', 'complaint', 'staff', 'erasure')
  ),
  CONSTRAINT "shop_alert_subscriber_email_normalised" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_alert_subscriber_product_email_uid"
  ON "shop_alert_subscriber" ("product", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_subscriber_subject_idx" ON "shop_alert_subscriber" ("identity_subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_subscriber_status_idx" ON "shop_alert_subscriber" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_alert_topic" (
  "subscriber_id" uuid NOT NULL REFERENCES "shop_alert_subscriber"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "email_on" boolean DEFAULT false NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "changed_by" text DEFAULT 'person' NOT NULL,
  CONSTRAINT "shop_alert_topic_pk" PRIMARY KEY ("subscriber_id", "topic"),
  CONSTRAINT "shop_alert_topic_topic_check" CHECK (
    "topic" IN ('shop.releases', 'shop.back_in_stock', 'art.followed_artists')
  ),
  CONSTRAINT "shop_alert_topic_changed_by_check" CHECK ("changed_by" IN ('person', 'migration', 'staff'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_topic_email_idx"
  ON "shop_alert_topic" ("topic", "subscriber_id") WHERE "email_on";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_alert_digest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL REFERENCES "shop_alert_subscriber"("id") ON DELETE CASCADE,
  "product" text NOT NULL,
  "local_date" date NOT NULL,
  "item_count" integer NOT NULL,
  "outbox_idempotency_key" text NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_alert_digest_cap_uid"
  ON "shop_alert_digest" ("subscriber_id", "product", "local_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_digest_unsent_idx"
  ON "shop_alert_digest" ("product", "local_date") WHERE "sent_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_alert_match" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL REFERENCES "shop_alert_subscriber"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "item_key" text NOT NULL,
  "group_key" text,
  "snapshot" jsonb NOT NULL,
  "matched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "digest_id" uuid REFERENCES "shop_alert_digest"("id") ON DELETE SET NULL,
  "dropped_reason" text,
  CONSTRAINT "shop_alert_match_topic_check" CHECK (
    "topic" IN ('shop.releases', 'shop.back_in_stock', 'art.followed_artists')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_alert_match_item_uid"
  ON "shop_alert_match" ("subscriber_id", "topic", "item_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_match_pending_idx"
  ON "shop_alert_match" ("subscriber_id") WHERE "digest_id" IS NULL AND "dropped_reason" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_alert_match_digest_idx" ON "shop_alert_match" ("digest_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_alert_announcement" (
  "item_key" text PRIMARY KEY NOT NULL,
  "announced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "announce" boolean NOT NULL,
  "expanded_at" timestamp with time zone
);
--> statement-breakpoint
-- Move the release-alert list. Same ids, so every link already sent still resolves. A confirmed
-- address stays confirmed with its consent record; a pending one keeps its request time; a
-- stopped one stays stopped. The stop token is stored only as its SHA-256 hash.
INSERT INTO "shop_alert_subscriber" (
  "id", "product", "email", "identity_subject_id", "status", "consent_text", "consent_source",
  "requested_at", "confirmation_sent_at", "confirmed_at", "stopped_at", "stop_reason",
  "link_version", "legacy_link_hash", "created_at", "updated_at"
)
SELECT
  "id", 'shop', lower(btrim("email")), "identity_subject_id", "status", "consent_text",
  "consent_source", COALESCE("confirm_requested_at", "confirmed_at", "created_at"),
  "confirm_requested_at", "confirmed_at", "stopped_at",
  CASE WHEN "status" = 'stopped' THEN 'link' ELSE NULL END,
  1, encode(sha256(convert_to("unsubscribe_token", 'UTF8')), 'hex'), "created_at", "updated_at"
FROM "shop_release_alert_subscription"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "shop_alert_topic" ("subscriber_id", "topic", "email_on", "changed_at", "changed_by")
SELECT "id", 'shop.releases', "status" = 'confirmed', "updated_at", 'migration'
FROM "shop_release_alert_subscription"
WHERE EXISTS (
  SELECT 1 FROM "shop_alert_subscriber" s WHERE s."id" = "shop_release_alert_subscription"."id"
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- The start point: every edition and original already on sale counts as announced and expanded,
-- so nobody is told about work published before alerts went on. Work published from now on has
-- its own row, written when it is published.
INSERT INTO "shop_alert_announcement" ("item_key", "announced_at", "announce", "expanded_at")
SELECT 'artwork:' || "id", now(), false, now()
FROM "shop_artwork"
WHERE "published_at" IS NOT NULL
  AND "archived_at" IS NULL
  AND (
    ("sales_channel" = 'shop' AND "eligible_for_edition_allocation")
    OR ("sales_channel" = 'art' AND "source_original_artwork_id" IS NULL)
  )
ON CONFLICT DO NOTHING;
