-- Shop release alerts: people who asked to hear about new editions. A visitor confirms by email
-- first; stopping keeps the row so a stopped address is not mailed again until it asks again.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_email_uid"
  ON "shop_release_alert_subscription" ("email");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_unsubscribe_uid"
  ON "shop_release_alert_subscription" ("unsubscribe_token");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_release_alert_subscription_confirm_uid"
  ON "shop_release_alert_subscription" ("confirm_token_hash")
  WHERE "confirm_token_hash" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_release_alert_subscription_status_idx"
  ON "shop_release_alert_subscription" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_release_alert_subscription_subject_idx"
  ON "shop_release_alert_subscription" ("identity_subject_id")
  WHERE "identity_subject_id" IS NOT NULL;
