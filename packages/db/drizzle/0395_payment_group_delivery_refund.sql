-- Staff refunds of the courier part of a combined ("Pay several") payment, one row per request.
-- The row is written, with the staff reason, under the group lock before Stripe is asked, and the
-- amount it holds counts against what is left of the courier charge until Stripe says the refund
-- returned nothing. So two requests made at the same time can never refund more than the courier
-- charge between them, whatever amounts they ask for. The Stripe idempotency key names the row.
--
-- Status: `pending` (asked for, or Stripe is still processing it) -> `succeeded` or `failed`
-- (Stripe made no refund, or the refund failed or was cancelled; the amount is free again).
-- Additive: one new table, nothing existing is altered. api_app reads, adds and updates rows; it
-- never deletes them (db:roles). worker_app has no access.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_group_delivery_refund" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_group_id" uuid NOT NULL,
  "delivery_quote_id" uuid NOT NULL,
  "amount_pence" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "staff_reason" text NOT NULL,
  "actor_user_id" text NOT NULL,
  "stripe_refund_id" text,
  "stripe_status" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_group_delivery_refund_amount_check" CHECK ("amount_pence" > 0),
  CONSTRAINT "payment_group_delivery_refund_status_check"
    CHECK ("status" IN ('pending', 'succeeded', 'failed')),
  CONSTRAINT "payment_group_delivery_refund_payment_group_id_payment_group_id_fk"
    FOREIGN KEY ("payment_group_id") REFERENCES "public"."payment_group"("id") ON DELETE restrict,
  CONSTRAINT "payment_group_delivery_refund_delivery_quote_id_delivery_quote_id_fk"
    FOREIGN KEY ("delivery_quote_id") REFERENCES "public"."delivery_quote"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_group_delivery_refund_quote_idx"
  ON "payment_group_delivery_refund" ("payment_group_id", "delivery_quote_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_delivery_refund_stripe_uidx"
  ON "payment_group_delivery_refund" ("stripe_refund_id")
  WHERE "stripe_refund_id" IS NOT NULL;
