-- Rollback for 0375_stripe_refund_watch. Roll back the application release first: it writes the
-- watch rows and compensating refund rows. Refuses to run while a compensating row exists, since
-- the previous checks cannot hold it; finance must review those payments first.
BEGIN;

SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "payment_refund" WHERE "source" = 'refund_reversal') THEN
    RAISE EXCEPTION 'payment_refund holds refund_reversal rows; review them before rolling back 0375';
  END IF;
END $$;
ALTER TABLE "payment_refund" DROP CONSTRAINT IF EXISTS "payment_refund_amount_positive";
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_amount_positive" CHECK ("amount_pence" > 0);
ALTER TABLE "payment_refund" DROP CONSTRAINT IF EXISTS "payment_refund_source_ck";
ALTER TABLE "payment_refund" ADD CONSTRAINT "payment_refund_source_ck" CHECK ("source" IN ('card_webhook', 'group_webhook', 'staff', 'blocked_capture', 'payout_topup'));
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
REVOKE ALL ON FUNCTION payment_refund_backfill_from_payout_lines(uuid) FROM PUBLIC;
DROP TABLE IF EXISTS "stripe_refund_watch";

COMMIT;
