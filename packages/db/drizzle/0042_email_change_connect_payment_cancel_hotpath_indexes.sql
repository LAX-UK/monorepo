-- Dual-confirm email change columns, Stripe Connect disabled reason, payment_status `cancelled`,
-- and hot-path indexes (lots/payments/bids/notifications) plus Xero webhook error partial index.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "pending_new_email" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_change_old_ok" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_change_new_ok" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email_change_expires_at" timestamp with time zone;

ALTER TABLE "legal_entity" ADD COLUMN IF NOT EXISTS "stripe_connect_disabled_reason" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'payment_status' AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE "payment_status" ADD VALUE 'cancelled';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "lot_sale_id_status_idx" ON "lot" ("sale_id", "status");
CREATE INDEX IF NOT EXISTS "payment_buyer_id_status_idx" ON "payment" ("buyer_id", "status");
CREATE INDEX IF NOT EXISTS "bid_lot_id_amount_created_at_idx" ON "bid" ("lot_id", "amount" DESC, "created_at" ASC);
CREATE INDEX IF NOT EXISTS "notification_user_id_created_at_idx" ON "notification" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "xero_webhook_event_error_created_idx" ON "xero_webhook_event" ("created_at") WHERE "error" IS NOT NULL;
