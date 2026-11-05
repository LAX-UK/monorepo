-- Rollback for 0309_drop_shop_release_alert_subscription. Roll back the application release first.
-- Recreates the table and refills it from the release-alert subscribers now in
-- shop_alert_subscriber, with the same ids, states and consent records. Stop tokens were only ever
-- kept as hashes there, so each restored row gets a placeholder token; links in emails already sent
-- keep resolving through legacy_link_hash once 0292 is back in force.
SET LOCAL lock_timeout = '30s';

CREATE TABLE IF NOT EXISTS "shop_release_alert_subscription" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "identity_subject_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "consent_text" text NOT NULL,
  "consent_source" text NOT NULL,
  "confirm_token_hash" text,
  "confirm_requested_at" timestamp with time zone,
  "unsubscribe_token" text NOT NULL,
  "confirmed_at" timestamp with time zone,
  "stopped_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_release_alert_subscription_status_ck"
    CHECK ("status" IN ('pending', 'confirmed', 'stopped')),
  CONSTRAINT "shop_release_alert_subscription_email_ck"
    CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "shop_release_alert_subscription_stopped_ck"
    CHECK (("status" = 'stopped') = ("stopped_at" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_email_uid"
  ON "shop_release_alert_subscription" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_unsubscribe_uid"
  ON "shop_release_alert_subscription" ("unsubscribe_token");
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_confirm_uid"
  ON "shop_release_alert_subscription" ("confirm_token_hash")
  WHERE "confirm_token_hash" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "shop_release_alert_subscription_status_idx"
  ON "shop_release_alert_subscription" ("status");
CREATE INDEX IF NOT EXISTS "shop_release_alert_subscription_subject_idx"
  ON "shop_release_alert_subscription" ("identity_subject_id")
  WHERE "identity_subject_id" IS NOT NULL;

INSERT INTO "shop_release_alert_subscription" (
  "id", "email", "identity_subject_id", "status", "consent_text", "consent_source",
  "confirm_requested_at", "unsubscribe_token", "confirmed_at", "stopped_at", "created_at",
  "updated_at"
)
SELECT
  s."id", s."email", s."identity_subject_id", s."status", s."consent_text", s."consent_source",
  s."confirmation_sent_at", 'restored-' || s."id"::text, s."confirmed_at", s."stopped_at",
  s."created_at", s."updated_at"
FROM "shop_alert_subscriber" s
WHERE s."product" = 'shop'
ON CONFLICT DO NOTHING;
