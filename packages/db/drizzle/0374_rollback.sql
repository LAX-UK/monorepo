-- Rollback for 0374_payout_seller_terms. Roll the release back first: nothing may still write the
-- new columns. Sale lines lose the link to the snapshot they paid (the snapshot rows stay), payouts
-- lose their hammer, commission and VAT totals (gross, platform fee and net are unchanged), and
-- refund lines lose the buyer's refund they answered for.
BEGIN;

SET LOCAL lock_timeout = '30s';
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
