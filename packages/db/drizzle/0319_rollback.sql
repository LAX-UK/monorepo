-- Rollback for 0319_bid_invoice. Roll back the application release first: it reads and writes
-- the invoices and their lines. This drops the invoice tables and the payment link; the payment
-- rows keep their frozen amounts, which the previous release prices from. Invoices raised after
-- 0319 are lost with the tables, and the previous release recomputes their due dates from each
-- payment row's created_at.
SET LOCAL lock_timeout = '5s';

DROP INDEX IF EXISTS "payment_invoice_id_idx";
ALTER TABLE "payment" DROP CONSTRAINT IF EXISTS "payment_invoice_id_bid_invoice_id_fk";
ALTER TABLE "payment" DROP COLUMN IF EXISTS "invoice_id";
DROP TABLE IF EXISTS "bid_invoice_line";
DROP TABLE IF EXISTS "bid_invoice";
