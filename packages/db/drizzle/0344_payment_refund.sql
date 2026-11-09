-- Buyer-side refunds: what the buyer was given back for a payment, kept in Bid's own table.
--   payment_refund   one row per refund, or per step of a refund reported as a running total.
--                    idempotency_key is the source_event_id of the payout line the same refund
--                    writes (the Stripe event id, "<event id>:<payment id>" for a Pay several
--                    charge, or the staff refund's own id), so a replay records nothing twice;
--                    a top-up from the payout ledger has its own key (see below). stripe_refund_id keeps the
--                    Stripe refund id when one is known. Append-only.
-- The invoice document sums it. Until now the figure came from the seller's payout ledger, which
-- has no line for a payment that never reached a seller (marked paid by staff, bank transfer).
-- Additive: a new table and a top-up from existing refund payout lines; the running release neither
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
  CONSTRAINT "payment_refund_source_ck" CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture', 'payout_topup'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_refund_idempotency_key_uidx" ON "payment_refund" ("idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_refund_payment_id_idx" ON "payment_refund" ("payment_id");
--> statement-breakpoint
-- Refunds made before this table existed are brought across from the refund lines of the payout
-- ledger (what the seller was charged back) as a top-up per payment, not line by line. A refund line
-- is merged in place, one per payout, payment and kind, and takes the newest event id each time it
-- grows, so a line's event id cannot say whether its amount was already copied: matching on it
-- counts a merged line twice (100 copied, merged to 300, copied again as 300, 400 in all). Sums
-- cannot be fooled that way. For each payment the function adds one row of
--   GREATEST(0, sum of its refund lines - sum of its payment_refund rows)
-- when that is above zero, keyed "payout_ledger_topup:<payment id>:<refund line pence total>". The
-- key makes a re-run, or two runs at once, add the same row once. Where the buyer side is already
-- the higher (a group excess, a blocked capture, a manual row) the difference is not positive and
-- nothing is added. Amounts are pounds turned to pence, per payment (not per line). Lines naming no
-- payment are left out. A refund the ledger never recorded (no line was written) cannot be
-- recovered here. The source of a top-up is payout_topup: it is not any one refund.
--
-- It is a function so it can run again after the release is live, which closes the gap of refunds
-- the previous release processed between this migration and the switch:
--   SELECT payment_refund_backfill_from_payout_lines();
-- The release also calls it for one payment (only_payment_id), under that payment's lock, before it
-- measures a refund against the record. It returns the number of rows it added, only ever adds rows
-- to payment_refund, and runs with the caller's rights (it can add nothing the caller could not).
-- Only the roles that need it may execute it (see migrate-roles.ts).
CREATE OR REPLACE FUNCTION payment_refund_backfill_from_payout_lines(only_payment_id uuid DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql
AS $fn$
DECLARE
  added integer;
BEGIN
  INSERT INTO "payment_refund" ("payment_id", "idempotency_key", "amount_pence", "currency", "source")
  SELECT
    t."payment_id",
    'payout_ledger_topup:' || t."payment_id" || ':' || t."line_pence",
    t."line_pence" - t."recorded_pence",
    'GBP',
    'payout_topup'
  FROM (
    SELECT
      l."payment_id",
      SUM(round(abs(l."amount") * 100))::bigint AS "line_pence",
      COALESCE((
        SELECT SUM(r."amount_pence")
        FROM "payment_refund" r
        WHERE r."payment_id" = l."payment_id" AND r."currency" = 'GBP'
      ), 0)::bigint AS "recorded_pence"
    FROM "payout_line" l
    WHERE l."kind" = 'refund'
      AND l."payment_id" IS NOT NULL
      AND (only_payment_id IS NULL OR l."payment_id" = only_payment_id)
    GROUP BY l."payment_id"
  ) t
  WHERE t."line_pence" - t."recorded_pence" > 0
  ON CONFLICT ("idempotency_key") DO NOTHING;
  GET DIAGNOSTICS added = ROW_COUNT;
  RETURN added;
END;
$fn$;
--> statement-breakpoint
-- Not callable by every role: a top-up writes buyer refund records.
REVOKE ALL ON FUNCTION payment_refund_backfill_from_payout_lines(uuid) FROM PUBLIC;
--> statement-breakpoint
SELECT payment_refund_backfill_from_payout_lines();
