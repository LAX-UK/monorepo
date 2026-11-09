-- Buyer-side refunds: what the buyer was given back for a payment, kept in Bid's own table.
--   payment_refund   one row per refund, or per step of a refund reported as a running total.
--                    idempotency_key is the source_event_id of the payout line the same refund
--                    writes (the Stripe event id, "<event id>:<payment id>" for a Pay several
--                    charge, or the staff refund's own id), so a replay records nothing twice and
--                    the copy below can tell a refund it already holds. stripe_refund_id keeps the
--                    Stripe refund id when one is known. Append-only.
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
  "stripe_refund_id" text,
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
-- (what the seller was charged back), one row per line, in pounds turned to pence. The row is
-- keyed on the line's source_event_id, the key every refund path now records under, so a refund
-- already recorded by the new code is never copied a second time and this can run again at any
-- time. The source is read from the event id the line was written for: a Stripe event id alone is
-- the card webhook, "<event id>:<payment id>" the Pay several webhook, anything else a staff
-- refund. A line with no source_event_id is keyed on its own id. Lines naming no payment are left
-- out. A refund the ledger never recorded (no line was written) cannot be recovered here.
--
-- It is a function so a later migration can run it again after the release is live, which closes
-- the gap of refunds the previous release processed between this migration and the switch:
--   SELECT payment_refund_backfill_from_payout_lines();
-- The release also calls it for one payment (only_payment_id), under that payment's lock, before
-- it measures a refund against the record, so a gap refund is never counted twice whichever of
-- the two runs first. It returns the number of rows it added, only ever adds rows to
-- payment_refund, and runs with the caller's rights (it can add nothing the caller could not).
CREATE OR REPLACE FUNCTION payment_refund_backfill_from_payout_lines(only_payment_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
  added integer;
BEGIN
  INSERT INTO "payment_refund" ("payment_id", "idempotency_key", "amount_pence", "currency", "source", "created_at")
  SELECT
    l."payment_id",
    COALESCE(l."source_event_id", 'payout_line:' || l."id"),
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
    AND (only_payment_id IS NULL OR l."payment_id" = only_payment_id)
    AND NOT EXISTS (
      SELECT 1 FROM "payment_refund" r
      WHERE r."idempotency_key" = COALESCE(l."source_event_id", 'payout_line:' || l."id")
    )
  ON CONFLICT ("idempotency_key") DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$fn$;
--> statement-breakpoint
SELECT payment_refund_backfill_from_payout_lines();
