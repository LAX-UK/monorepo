-- Zoho Campaigns unsubscribes and hard bounces recorded in LAX's own suppression list.
--   email_suppression.source                          where an entry came from (null = Postmark or LAX).
--   email_suppression_reason_check                    adds 'unsubscribed_marketing', a marketing and
--                                                     alert opt-out that never blocks other mail.
--   zoho_campaigns_suppression_state                  the newest event already read, one row per mode.
-- Additive: the running release neither reads the new column or table nor writes the new reason.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "email_suppression" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_reason_check";
--> statement-breakpoint
ALTER TABLE "email_suppression"
  ADD CONSTRAINT "email_suppression_reason_check" CHECK (
    "reason" IN (
      'hard_bounce', 'complaint', 'manual', 'unsubscribe', 'soft_bounce_threshold',
      'unsubscribed_marketing'
    )
  );
--> statement-breakpoint
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_source_check";
--> statement-breakpoint
ALTER TABLE "email_suppression"
  ADD CONSTRAINT "email_suppression_source_check" CHECK ("source" IS NULL OR "source" IN ('zoho_campaigns'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_campaigns_suppression_state" (
  "mode" text PRIMARY KEY NOT NULL,
  "watermark" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_campaigns_suppression_state_mode_check" CHECK ("mode" IN ('dry_run', 'live'))
);
