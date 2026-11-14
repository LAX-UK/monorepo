-- Rollback for 0389_shop_original_sale_books_invoice. Roll the release back first: the earlier
-- shop-api only issues Stripe Invoices and never sets `paid_at`.
--
-- Only the behaviour is removed: the numbering trigger and its function, and the Stripe
-- attribution function. The columns, their CHECKs and unique indexes stay, with their data: which
-- sales Books invoices, their Payment Links, their `LAX-INV-` numbers, the payments that paid them
-- and the invoice recipients. A later forward run finds them as they were, so a Payment Link paid
-- after it still completes its sale, and no number is lost or issued twice. Numbers already taken
-- stay taken in `shop_invoice_counter` (it is never wound back).
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
DROP TRIGGER IF EXISTS "shop_original_sale_invoice_number_trg" ON "shop_original_sale";
DROP FUNCTION IF EXISTS "shop_original_sale_assign_invoice_number"();
DROP FUNCTION IF EXISTS "accounting_stripe_shop_original_sale"(text);

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811764800000;

COMMIT;
