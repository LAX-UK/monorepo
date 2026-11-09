-- Buyer-side refunds: what the buyer was given back for a payment, kept in Bid's own table.
--   payment_refund   one row per refund, or per step of a refund reported as a running total.
--                    idempotency_key is the Stripe refund id when known, otherwise the id of the
--                    event that reported it, so a replay records nothing twice. Append-only.
-- The invoice document sums it. Until now the figure came from the seller's payout ledger, which
-- has no line for a payment that never reached a seller (marked paid by staff, bank transfer).
-- Additive: a new table and a copy of existing refund payout lines; the running release neither
-- reads nor writes it.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payment_refund" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_id" uuid NOT NULL,
  "idempotency_key" text NOT NULL,
  "amount_pence" integer NOT NULL,
  "currency" char(3) NOT NULL,
  "source" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "payment_refund_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payment" ("id") ON DELETE RESTRICT,
  CONSTRAINT "payment_refund_amount_positive" CHECK ("amount_pence" > 0),
  CONSTRAINT "payment_refund_currency_ck" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "payment_refund_source_ck" CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refund_idempotency_key_uidx" ON "payment_refund" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refund_payment_id_idx" ON "payment_refund" ("payment_id");
--> statement-breakpoint
-- Refunds made before this table existed are copied from the refund lines of the payout ledger
-- (what the seller was charged back), one row per line, in pounds turned to pence. The source is
-- read from the event id the line was written for: a Stripe event id alone is the card webhook,
-- "<event id>:<payment id>" the Pay several webhook, anything else a staff refund. The key is the
-- line's own id, so running it again changes nothing. Lines naming no payment are left out.
-- A refund the ledger never recorded (no line was written) cannot be recovered here.
INSERT INTO "payment_refund" ("payment_id", "idempotency_key", "amount_pence", "currency", "source", "created_at")
SELECT
  l."payment_id",
  'backfill:payout_line:' || l."id",
  round(abs(l."amount") * 100)::integer,
  'GBP',
  CASE
    WHEN l."source_event_id" LIKE 'evt\_%:%' THEN 'group_webhook'
    WHEN l."source_event_id" LIKE 'evt\_%' THEN 'card_webhook'
    ELSE 'staff'
  END,
  l."created_at"
FROM "payout_line" l
WHERE l."kind" = 'refund'
  AND l."payment_id" IS NOT NULL
  AND round(abs(l."amount") * 100) > 0
ON CONFLICT ("idempotency_key") DO NOTHING;
