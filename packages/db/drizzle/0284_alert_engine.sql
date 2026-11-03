-- Alert engine, LAX Bid side (first release: new-sale alerts).
--   bid_alert_subscriber / _topic / _match / _digest / _announcement: one table shape shared with
--     Shop's later tables. A digest is unique per person, product and London day (the frequency
--     cap); a match is unique per person, topic and item; an announcement is unique per item, so a
--     sale is announced once however often it is published.
--   The visitor sale-alert list (0275) moves across with the same ids, states and consent
--     records, so confirmation and unsubscribe links already sent keep working and nobody is asked
--     to confirm again. The old table is left in place, unread, and is dropped by a later migration.
--   notification gains the sale_announced type and a nullable sale_id; notification_preference
--     gains new_sales_in_app.
-- Additive: the running release keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_alert_subscriber" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product" text NOT NULL,
  "email" text NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
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
  CONSTRAINT "bid_alert_subscriber_product_check" CHECK ("product" IN ('bid')),
  CONSTRAINT "bid_alert_subscriber_status_check" CHECK ("status" IN ('pending', 'confirmed', 'stopped')),
  CONSTRAINT "bid_alert_subscriber_stop_reason_check" CHECK (
    "stop_reason" IS NULL OR "stop_reason" IN ('link', 'one_click', 'settings', 'complaint', 'staff', 'erasure')
  ),
  CONSTRAINT "bid_alert_subscriber_email_normalised" CHECK ("email" = lower(btrim("email")))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_subscriber_product_email_uid"
  ON "bid_alert_subscriber" ("product", "email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_subscriber_subject_idx" ON "bid_alert_subscriber" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_subscriber_status_idx" ON "bid_alert_subscriber" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_alert_topic" (
  "subscriber_id" uuid NOT NULL REFERENCES "bid_alert_subscriber"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "email_on" boolean DEFAULT false NOT NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "changed_by" text DEFAULT 'person' NOT NULL,
  CONSTRAINT "bid_alert_topic_pk" PRIMARY KEY ("subscriber_id", "topic"),
  CONSTRAINT "bid_alert_topic_topic_check" CHECK ("topic" IN ('bid.new_sales', 'bid.artists', 'bid.searches')),
  CONSTRAINT "bid_alert_topic_changed_by_check" CHECK ("changed_by" IN ('person', 'migration', 'staff'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_topic_email_idx"
  ON "bid_alert_topic" ("topic", "subscriber_id") WHERE "email_on";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_alert_digest" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL REFERENCES "bid_alert_subscriber"("id") ON DELETE CASCADE,
  "product" text NOT NULL,
  "local_date" date NOT NULL,
  "item_count" integer NOT NULL,
  "outbox_idempotency_key" text NOT NULL,
  "sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_digest_cap_uid"
  ON "bid_alert_digest" ("subscriber_id", "product", "local_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_digest_unsent_idx"
  ON "bid_alert_digest" ("product", "local_date") WHERE "sent_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_alert_match" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subscriber_id" uuid NOT NULL REFERENCES "bid_alert_subscriber"("id") ON DELETE CASCADE,
  "topic" text NOT NULL,
  "item_key" text NOT NULL,
  "group_key" text,
  "snapshot" jsonb NOT NULL,
  "matched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "digest_id" uuid REFERENCES "bid_alert_digest"("id") ON DELETE SET NULL,
  "dropped_reason" text,
  CONSTRAINT "bid_alert_match_topic_check" CHECK ("topic" IN ('bid.new_sales', 'bid.artists', 'bid.searches'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_alert_match_item_uid"
  ON "bid_alert_match" ("subscriber_id", "topic", "item_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_match_pending_idx"
  ON "bid_alert_match" ("subscriber_id") WHERE "digest_id" IS NULL AND "dropped_reason" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_alert_match_digest_idx" ON "bid_alert_match" ("digest_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_alert_announcement" (
  "item_key" text PRIMARY KEY NOT NULL,
  "announced_at" timestamp with time zone DEFAULT now() NOT NULL,
  "announce" boolean NOT NULL,
  "expanded_at" timestamp with time zone
);
--> statement-breakpoint
-- Move the visitor sale-alert list. Same ids, so every link already sent still resolves. A
-- confirmed address stays confirmed with its consent record; a pending one keeps its request time,
-- so an unexpired confirmation link still works; an unsubscribed one becomes stopped.
INSERT INTO "bid_alert_subscriber" (
  "id", "product", "email", "user_id", "status", "consent_text", "consent_source",
  "requested_at", "confirmation_sent_at", "confirmed_at", "stopped_at", "stop_reason",
  "link_version", "created_at", "updated_at"
)
SELECT
  "id", 'bid', lower(btrim("email")), "linked_user_id",
  CASE "status" WHEN 'unsubscribed' THEN 'stopped' ELSE "status" END,
  "consent_text", "consent_source", "requested_at", "confirmation_sent_at", "confirmed_at",
  "unsubscribed_at", CASE WHEN "status" = 'unsubscribed' THEN 'link' ELSE NULL END,
  1, "created_at", "updated_at"
FROM "visitor_sale_alert_subscriber"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "bid_alert_topic" ("subscriber_id", "topic", "email_on", "changed_at", "changed_by")
SELECT "id", 'bid.new_sales', "status" = 'confirmed', "updated_at", 'migration'
FROM "visitor_sale_alert_subscriber"
WHERE EXISTS (SELECT 1 FROM "bid_alert_subscriber" b WHERE b."id" = "visitor_sale_alert_subscriber"."id")
ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "sale_id" uuid REFERENCES "sale"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "new_sales_in_app" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
--> statement-breakpoint
ALTER TABLE notification
  ADD CONSTRAINT notification_type_check CHECK (
    type IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller',
      'kyc_resubmission_required',
      'submission_received_for_review',
      'submission_approved',
      'submission_rejected',
      'submission_converted',
      'submission_draft_reminder',
      'submission_changes_requested',
      'consignment_agreement_reminder',
      'consignment_update',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected',
      'staff_role_expired',
      'staff_role_expired_admin',
      'staff_role_changed',
      'staff_role_changed_admin',
      'lot_ready_for_collection',
      'lot_shipped',
      'lot_delivered',
      'organisation_member_left',
      'payout_bank_changed',
      'delivery_quote_ready',
      'payout_problem',
      'bid_refused_limit',
      'access_requested',
      'access_request_decided',
      'consignment_message',
      'watchlist_reminder',
      'kyc_approved',
      'kyc_declined',
      'sale_cancelled',
      'payment_reminder',
      'buyer_default_notice',
      'sale_announced'
    )
  );
