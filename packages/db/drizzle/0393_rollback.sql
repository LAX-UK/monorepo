-- Rollback for 0393_books_payout_bills. Roll the release back first: the earlier release knows no
-- `bill_payment`. Every bill payment never sent is cancelled first (each with a `cancel` history
-- row); then the kind, reference and totals CHECKs are restored as 0386 left them, NOT VALID (rows
-- already written stay, append-only history included; nothing new of the kind can be written).
-- api_app's rule is left as 0393 made it, with the refusal kept (as 0388's rollback kept its own):
-- a parked payout document stays parked and is never moved by api_app while the earlier release,
-- which knows nothing of it, runs. Restoring 0388's function, if ever needed, is that function from
-- 0388_accounting_shop_refunds.sql, and then such documents could be released unchanged by api_app:
-- do not, while any is parked. Removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
INSERT INTO "accounting_document_event"
  ("document_id", "action", "from_state", "to_state", "attempts", "detail", "occurred_at")
SELECT "id", 'cancel', "state", 'cancelled', "attempts",
       jsonb_build_object('reason', 'rollback_0393'), now()
  FROM "accounting_document"
 WHERE "kind" = 'bill_payment' AND "state" IN ('pending', 'failed');
UPDATE "accounting_document"
   SET "state" = 'cancelled', "lease_token" = NULL, "lease_expires_at" = NULL,
       "last_error_class" = NULL, "updated_at" = now()
 WHERE "kind" = 'bill_payment' AND "state" IN ('pending', 'failed');

ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_kind_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_kind_ck"
  CHECK ("kind" IN ('invoice', 'payment', 'credit_note', 'bill', 'contact', 'expense', 'transfer'))
  NOT VALID;
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_reference_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_reference_ck" CHECK (
  "lax_reference" ~ '^LAX-(BID|SHOP|ART)-(INV|PAY|CN|BILL|CON|EXP|TRF)-[a-z0-9][a-z0-9_-]{0,63}$'
  AND "lax_reference" LIKE 'LAX-' || CASE "product"
    WHEN 'bid' THEN 'BID' WHEN 'shop' THEN 'SHOP' ELSE 'ART' END
    || '-' || CASE "kind"
    WHEN 'invoice' THEN 'INV' WHEN 'payment' THEN 'PAY' WHEN 'credit_note' THEN 'CN'
    WHEN 'bill' THEN 'BILL' WHEN 'expense' THEN 'EXP' WHEN 'transfer' THEN 'TRF' ELSE 'CON' END
    || '-%'
) NOT VALID;
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_totals_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_totals_ck" CHECK (
  "net_pence" >= 0 AND "vat_pence" >= 0 AND "gross_pence" = "net_pence" + "vat_pence"
  AND (("kind" = 'contact') = ("gross_pence" = 0 AND "net_pence" = 0))
  AND ("kind" NOT IN ('payment', 'expense', 'transfer') OR "vat_pence" = 0)
) NOT VALID;

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812196800000;

COMMIT;
