-- Rollback for 0378_payout_seller_terms. Roll the release back first: nothing may still write the
-- new columns. Sale lines lose the link to the snapshot they paid (the snapshot rows stay), payouts
-- lose their hammer, commission and VAT totals (gross, platform fee and net are unchanged), and
-- refund lines lose the buyer's refund they answered for. The top-up of the buyer's refund record
-- goes back to adding up line amounts with their sign (as 0376 left it), and seller-terms rows lose
-- the held-only re-pricing guard.
--
-- Forward-fix only once this release has charged a refund by the new rule. The previous release
-- reads a refund line's amount as the buyer's refund, so a line that charged the seller's share,
-- nothing, or a credit would be misread: the top-up would record buyer refunds that never happened
-- and the next refund event would charge the seller again. A line giving back a failed refund
-- (negative buyer refund) belongs to the same rule, so it stops the rollback too, whatever its
-- amount. The rollback stops while any such line exists. To check first:
--   SELECT count(*) FROM "payout_line"
--   WHERE "kind" = 'refund' AND "buyer_refund_pence" IS NOT NULL
--     AND ("buyer_refund_pence" < 0 OR "buyer_refund_pence" <> -"amount" * 100);
BEGIN;

SET LOCAL lock_timeout = '30s';
LOCK TABLE "payout_line" IN SHARE MODE;
-- The column is gone once the rollback has run, so it is read only while it is there.
DO $$
DECLARE
  new_rule_lines bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'payout_line'
      AND column_name = 'buyer_refund_pence'
  ) THEN
    SELECT count(*) INTO new_rule_lines FROM "payout_line"
    WHERE "kind" = 'refund' AND "buyer_refund_pence" IS NOT NULL
      AND ("buyer_refund_pence" < 0 OR "buyer_refund_pence" <> -"amount" * 100);
    IF new_rule_lines > 0 THEN
      RAISE EXCEPTION '% refund line(s) charge the seller other than the buyer''s refund; 0378 is forward-fix only once such lines exist', new_rule_lines;
    END IF;
  END IF;
END $$;
DROP TRIGGER IF EXISTS "sale_seller_terms_reprice_held_only" ON "sale_seller_terms";
DROP FUNCTION IF EXISTS "sale_seller_terms_reprice_held_only"();
-- The top-up as migration 0376 left it (refund lines added up with their sign): it must not read
-- the column dropped below.
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
