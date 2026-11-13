-- Rollback for 0374_payout_seller_terms. Roll the release back first: nothing may still write the
-- new columns. Sale lines lose the link to the snapshot they paid (the snapshot rows stay), payouts
-- lose their hammer, commission and VAT totals (gross, platform fee and net are unchanged), and
-- refund lines lose the buyer's refund they answered for. The top-up of the buyer's refund record
-- goes back to reading line amounts, and seller-terms rows lose the held-only re-pricing guard.
BEGIN;

SET LOCAL lock_timeout = '30s';
DROP TRIGGER IF EXISTS "sale_seller_terms_reprice_held_only" ON "sale_seller_terms";
DROP FUNCTION IF EXISTS "sale_seller_terms_reprice_held_only"();
-- The top-up as migration 0344 wrote it: it must not read the column dropped below.
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
DROP INDEX IF EXISTS "payout_line_seller_terms_idx";
ALTER TABLE "payout" DROP CONSTRAINT IF EXISTS "payout_seller_terms_totals_ck";
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_buyer_refund_ck";
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_seller_terms_sale_ck";
ALTER TABLE "payout_line" DROP CONSTRAINT IF EXISTS "payout_line_seller_terms_id_fkey";
ALTER TABLE "payout"
  DROP COLUMN IF EXISTS "commission_vat_amount",
  DROP COLUMN IF EXISTS "commission_amount",
  DROP COLUMN IF EXISTS "hammer_amount";
ALTER TABLE "payout_line"
  DROP COLUMN IF EXISTS "buyer_refund_pence",
  DROP COLUMN IF EXISTS "seller_terms_id";

COMMIT;
