-- Rollback for 0385_stripe_fees_payouts_books. Roll the release back first: nothing may still
-- read or write these tables. Every expense and transfer document is cancelled first (each with a
-- `cancel` history row), because the earlier release knows neither kind; cancelled rows keep the
-- earlier CHECKs satisfiable only once their kinds are allowed, so the kind, reference and totals
-- CHECKs are restored NOT VALID (rows already written stay, append-only history included; nothing
-- new of either kind can be written). Reports already stored in object storage under
-- `accounting/reconciliation/` stay there (delete them there if they are not wanted); only the
-- record of them goes. The Stripe read cursor and the balance transaction rows go: a later deploy
-- reads Stripe again from the start, and the LAX references stop any second document. A
-- transaction whose document was cancelled here is then parked `was_cancelled` (a cancelled
-- document is never sent): book those by hand.
-- Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '5s';
INSERT INTO "accounting_document_event"
  ("document_id", "action", "from_state", "to_state", "attempts", "detail", "occurred_at")
SELECT "id", 'cancel', "state", 'cancelled', "attempts",
       jsonb_build_object('reason', 'rollback_0385'), now()
  FROM "accounting_document"
 WHERE "kind" IN ('expense', 'transfer') AND "state" IN ('pending', 'failed');
UPDATE "accounting_document"
   SET "state" = 'cancelled', "lease_token" = NULL, "lease_expires_at" = NULL,
       "last_error_class" = NULL, "updated_at" = now()
 WHERE "kind" IN ('expense', 'transfer') AND "state" IN ('pending', 'failed');

ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_kind_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_kind_ck"
  CHECK ("kind" IN ('invoice', 'payment', 'credit_note', 'bill', 'contact')) NOT VALID;
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_reference_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_reference_ck" CHECK (
  "lax_reference" ~ '^LAX-(BID|SHOP|ART)-(INV|PAY|CN|BILL|CON)-[a-z0-9][a-z0-9_-]{0,63}$'
  AND "lax_reference" LIKE 'LAX-' || CASE "product"
    WHEN 'bid' THEN 'BID' WHEN 'shop' THEN 'SHOP' ELSE 'ART' END
    || '-' || CASE "kind"
    WHEN 'invoice' THEN 'INV' WHEN 'payment' THEN 'PAY' WHEN 'credit_note' THEN 'CN'
    WHEN 'bill' THEN 'BILL' ELSE 'CON' END || '-%'
) NOT VALID;
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_totals_ck";
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_totals_ck" CHECK (
  "net_pence" >= 0 AND "vat_pence" >= 0 AND "gross_pence" = "net_pence" + "vat_pence"
  AND (("kind" = 'contact') = ("gross_pence" = 0 AND "net_pence" = 0))
  AND ("kind" <> 'payment' OR "vat_pence" = 0)
) NOT VALID;

DROP FUNCTION IF EXISTS "accounting_stripe_shop_order"(text);
DROP TABLE IF EXISTS "accounting_reconciliation_report";
DROP TABLE IF EXISTS "accounting_stripe_balance_txn";
DROP FUNCTION IF EXISTS "accounting_stripe_balance_txn_append_only"();
DROP TABLE IF EXISTS "accounting_stripe_cursor";
DROP TABLE IF EXISTS "accounting_stripe_account";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1811419200000;

COMMIT;
