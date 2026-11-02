-- Visitor sale alerts: an email-only list for people without an account, kept apart from the
-- newsletter and from client notification preferences. Double opt-in: an address is mailed alerts
-- only once its status is 'confirmed'. The consent wording, source and times are kept as proof.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visitor_sale_alert_subscriber" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "consent_text" text NOT NULL,
  "consent_source" text NOT NULL,
  "requested_at" timestamp with time zone NOT NULL,
  "confirmation_sent_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "unsubscribed_at" timestamp with time zone,
  "linked_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "visitor_sale_alert_subscriber_status_check" CHECK ("status" IN ('pending', 'confirmed', 'unsubscribed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visitor_sale_alert_subscriber_email_uid"
  ON "visitor_sale_alert_subscriber" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_sale_alert_subscriber_status_idx"
  ON "visitor_sale_alert_subscriber" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visitor_sale_alert_subscriber_linked_user_idx"
  ON "visitor_sale_alert_subscriber" ("linked_user_id");
