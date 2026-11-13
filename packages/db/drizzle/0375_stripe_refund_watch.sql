-- Refunds are counted only once Stripe reports them succeeded, without relying on the payments
-- endpoint being subscribed to charge.refund.updated:
--   * stripe_refund_watch: one row per Stripe refund seen pending or requires_action. The refund
--     reconcile job re-reads each due row from Stripe, with backoff, and once the refund has
--     succeeded, failed or been cancelled it settles the charge's totals through the same path as
--     the webhook and marks the row settled. A refund staff made while it was still pending keeps
--     who made it and why (staff_refund), so it is recorded as their refund once it succeeds.
--   * payment_refund may now hold a compensating (negative) row, source 'refund_reversal', written
--     when a refund that had been counted is reported failed or cancelled. Every other source stays
--     above zero.
--   * payment_refund_backfill_from_payout_lines adds refund payout lines up with their sign, so a
--     compensating payout line (a refund that failed, given back to the seller) cancels the line it
--     corrects instead of being counted as a second refund. Refund lines were only ever written
--     negative, so the result is unchanged for every existing payment.
-- Additive for running services: the previous release never writes the new source or table.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stripe_refund_watch" (
  "stripe_refund_id" text PRIMARY KEY NOT NULL,
  "stripe_charge_id" text NOT NULL,
  "status" text NOT NULL,
  "amount_pence" integer NOT NULL,
  "payment_id" uuid,
  "staff_refund" jsonb,
  "attempts" integer DEFAULT 0 NOT NULL,
  "next_check_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_error" text,
  "settled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "stripe_refund_watch_status_ck" CHECK ("status" IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
  CONSTRAINT "stripe_refund_watch_amount_ck" CHECK ("amount_pence" >= 0),
  CONSTRAINT "stripe_refund_watch_attempts_ck" CHECK ("attempts" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_refund_watch_due_idx" ON "stripe_refund_watch" ("next_check_at") WHERE "settled_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_refund_watch_charge_idx" ON "stripe_refund_watch" ("stripe_charge_id");
--> statement-breakpoint
ALTER TABLE "payment_refund" DROP CONSTRAINT IF EXISTS "payment_refund_source_ck";
--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_source_ck" CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture', 'payout_topup', 'refund_reversal')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment_refund" VALIDATE CONSTRAINT "payment_refund_source_ck";
--> statement-breakpoint
ALTER TABLE "payment_refund" DROP CONSTRAINT IF EXISTS "payment_refund_amount_positive";
--> statement-breakpoint
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_amount_positive" CHECK ("amount_pence" > 0 OR ("source" = 'refund_reversal' AND "amount_pence" < 0)) NOT VALID;
--> statement-breakpoint
ALTER TABLE "payment_refund" VALIDATE CONSTRAINT "payment_refund_amount_positive";
--> statement-breakpoint
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
      round(-SUM(l."amount") * 100)::bigint AS "line_pence",
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
REVOKE ALL ON FUNCTION payment_refund_backfill_from_payout_lines(uuid) FROM PUBLIC;
