-- An accepted courier quote can be paid in the same payment as the invoices it belongs to. This
-- table records which quotes a combined payment charges, and the pounds charged for each, so the
-- checkout, the settlement check and the receipt all read one stored figure. A quote can be charged
-- by one payment only: the unique index holds it while the payment is open and after it is paid,
-- and a payment that is let go before it is paid deletes its rows so the quote can be charged again.
-- The delivery money is not part of any invoice's `payment.amount`, so seller payouts and platform
-- fees, which are worked out on that amount, do not change.
-- Additive: one new table, nothing existing is altered.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_group_delivery" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_group_id" uuid NOT NULL,
  "delivery_quote_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "amount" numeric(18, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_group_delivery_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_group_delivery_payment_group_id_payment_group_id_fk"
    FOREIGN KEY ("payment_group_id") REFERENCES "public"."payment_group"("id") ON DELETE restrict,
  CONSTRAINT "payment_group_delivery_delivery_quote_id_delivery_quote_id_fk"
    FOREIGN KEY ("delivery_quote_id") REFERENCES "public"."delivery_quote"("id") ON DELETE restrict,
  CONSTRAINT "payment_group_delivery_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_group_delivery_quote_uidx"
  ON "payment_group_delivery" ("delivery_quote_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_group_delivery_group_idx"
  ON "payment_group_delivery" ("payment_group_id");
