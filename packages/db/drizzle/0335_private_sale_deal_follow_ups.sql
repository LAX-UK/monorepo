-- Two additions to private sale deals.
-- 1. A bank transfer finance has seen land is recorded as a paid payment of the deal: who recorded
--    it and the bank's reference. Both are null for a payment taken through the checkout, so a
--    running service keeps working. A recorded transfer is always on the bank transfer rail and
--    always carries its reference.
-- 2. The deadline reminders already sent for a deal, one row per deadline and step, so a repeated
--    or parallel run sends each reminder once.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "private_sale_deal_payment"
  ADD COLUMN IF NOT EXISTS "recorded_by_user_id" text REFERENCES "user" ("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "private_sale_deal_payment"
  ADD COLUMN IF NOT EXISTS "bank_reference" text;
--> statement-breakpoint
ALTER TABLE "private_sale_deal_payment"
  ADD CONSTRAINT "private_sale_deal_payment_recorded_check"
  CHECK (
    ("recorded_by_user_id" IS NULL AND "bank_reference" IS NULL)
    OR ("rail" = 'gb_bank_transfer' AND "bank_reference" IS NOT NULL AND "bank_reference" <> '')
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "private_sale_deal_payment" VALIDATE CONSTRAINT "private_sale_deal_payment_recorded_check";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_reminder" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL REFERENCES "private_sale_deal" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "step" text NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_reminder_kind_check" CHECK ("kind" IN ('payment', 'collection')),
  CONSTRAINT "private_sale_deal_reminder_step_check" CHECK ("step" IN ('before_due', 'due_day', 'overdue'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_reminder_step_uidx"
  ON "private_sale_deal_reminder" ("deal_id", "kind", "step");
