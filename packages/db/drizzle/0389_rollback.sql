-- Rollback for 0389_shop_original_sale_books_invoice. Roll the release back first: the earlier
-- shop-api only issues Stripe Invoices. A `books` sale still waiting for payment keeps its Payment
-- Link in Stripe: deactivate it there and issue the sale again (the earlier release cannot complete
-- it). Numbers already taken stay taken in `shop_invoice_counter` (it is never wound back, so no
-- number is ever issued twice); the Books documents already stored stay as they are.
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS "shop_original_sale_invoice_number_trg" ON "shop_original_sale";
DROP FUNCTION IF EXISTS "shop_original_sale_assign_invoice_number"();
DROP INDEX IF EXISTS "shop_original_sale_payment_link_uid";
DROP INDEX IF EXISTS "shop_original_sale_invoice_number_uid";
ALTER TABLE "shop_original_sale" DROP CONSTRAINT IF EXISTS "shop_original_sale_invoice_number_chk";
ALTER TABLE "shop_original_sale" DROP CONSTRAINT IF EXISTS "shop_original_sale_invoice_issuer_chk";
ALTER TABLE "shop_original_sale"
  DROP COLUMN IF EXISTS "stripe_payment_link_id",
  DROP COLUMN IF EXISTS "invoice_number",
  DROP COLUMN IF EXISTS "paid_at",
  DROP COLUMN IF EXISTS "invoice_issuer";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811764800000;

COMMIT;
