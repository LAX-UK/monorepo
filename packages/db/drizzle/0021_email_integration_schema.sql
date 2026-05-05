ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_status" text DEFAULT 'ok' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_status_changed_at" timestamp with time zone;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'user_email_status_check'
	) THEN
		ALTER TABLE "user" ADD CONSTRAINT "user_email_status_check"
			CHECK ("email_status" IN ('ok', 'bounced', 'complained'));
	END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "outbid_email" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "won_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "lost_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "ending_soon_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "watchlist_email" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "payment_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "lot_ended_seller_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "outbid_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "won_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "lost_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "ending_soon_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "watchlist_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "payment_whatsapp" boolean DEFAULT false NOT NULL;
ALTER TABLE "notification_preference" ADD COLUMN IF NOT EXISTS "lot_ended_seller_whatsapp" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"user_id" text,
	"to_email_hash" text NOT NULL,
	"to_snapshot" text,
	"to_snapshot_purge_at" timestamp with time zone,
	"template" text NOT NULL,
	"vars" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"last_error" text,
	"message_id" text,
	"stream" text DEFAULT 'transactional' NOT NULL,
	"category" text NOT NULL,
	"flagged_address" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_outbox_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "email_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
	CONSTRAINT "email_outbox_status_check" CHECK ("status" IN ('pending', 'sending', 'sent', 'failed', 'suppressed')),
	CONSTRAINT "email_outbox_stream_check" CHECK ("stream" IN ('transactional', 'broadcast')),
	CONSTRAINT "email_outbox_category_check" CHECK ("category" IN ('auth', 'transactional'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "email_outbox_status_created_at_idx" ON "email_outbox" USING btree ("status", "created_at");
CREATE INDEX IF NOT EXISTS "email_outbox_user_id_idx" ON "email_outbox" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "email_outbox_message_id_idx" ON "email_outbox" USING btree ("message_id");
CREATE INDEX IF NOT EXISTS "email_outbox_snapshot_purge_idx" ON "email_outbox" USING btree ("to_snapshot_purge_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_id" uuid,
	"message_id" text,
	"type" text NOT NULL,
	"provider" text DEFAULT 'postmark' NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_event_outbox_id_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."email_outbox"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
	CONSTRAINT "email_event_type_check" CHECK ("type" IN ('delivered', 'bounce', 'soft_bounce', 'complaint', 'open', 'click', 'unsubscribe'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "email_event_message_id_idx" ON "email_event" USING btree ("message_id");
CREATE INDEX IF NOT EXISTS "email_event_outbox_id_idx" ON "email_event" USING btree ("outbox_id");
CREATE INDEX IF NOT EXISTS "email_event_type_received_at_idx" ON "email_event" USING btree ("type", "received_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "email_suppression" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_suppression_reason_check" CHECK ("reason" IN ('hard_bounce', 'complaint', 'manual', 'unsubscribe'))
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "newsletter_signup_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_hash" text NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"zoho_response_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_signup_log_status_check" CHECK ("status" IN ('queued', 'pushed', 'rejected', 'failed'))
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "newsletter_signup_log_email_hash_idx" ON "newsletter_signup_log" USING btree ("email_hash");
CREATE INDEX IF NOT EXISTS "newsletter_signup_log_status_created_at_idx" ON "newsletter_signup_log" USING btree ("status", "created_at");

-- Grandfather users created before the email-verification rollout so flipping
-- REQUIRE_EMAIL_VERIFICATION=true does not lock out existing accounts.
UPDATE "user"
SET "email_verified" = true
WHERE "created_at" < now()
  AND "email_verified" = false;
