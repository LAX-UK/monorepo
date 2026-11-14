-- Stripe fees and payouts to Zoho Books, and the daily reconciliation (plan v2, PR 13, flow 25).
-- Applies after 0384. Books stays in dry run: nothing here sends anything.
--
-- 1. Two document kinds. `expense` (Stripe's fees, paid from the Stripe clearing account,
--    `LAX-<P>-EXP-<balance transaction>`) and `transfer` (a Stripe payout, clearing to the bank,
--    `LAX-<P>-TRF-<payout>`). Both carry no VAT. The kind, reference and totals CHECKs gain them;
--    every other kind's rule is unchanged.
-- 2. `accounting_stripe_account`: which product a Stripe account's own movements (payouts,
--    Stripe's own fees) belong to. Written by an engineer from the runbook, never by an
--    application role: the worker only reads it, so which company a payout belongs to is a stored
--    LAX row, never guessed.
-- 3. `accounting_stripe_cursor`: how far each account has been read. Moves forward only.
-- 4. `accounting_stripe_balance_txn`: one row per balance transaction read and what was done with
--    it (booked, parked for a person and why, nothing to book, Books not aimed at the product).
--    The primary key is the duplicate guard: a transaction is decided once, by whichever run
--    inserts its row, in the same transaction as its documents. Append-only (no UPDATE or DELETE
--    is granted, and a trigger refuses them for every role).
-- 5. `accounting_reconciliation_report`: where each company's daily report is stored (private
--    object storage) and how many mismatches it found.
--
-- 6. `accounting_stripe_shop_order(text)`: which Shop order, if any, holds a Stripe PaymentIntent.
--    The worker may not read a Shop order's PaymentIntent column; this definer function answers
--    that one question (the order id, or null) and nothing else.
--
-- Grants (db:roles): worker_app executes the function; reads the accounts; reads, adds and moves the cursor; reads and
-- adds balance transaction rows; reads, adds and replaces a day's report row. No other role has
-- access. No personal data is stored: ids, types, amounts and days only.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_kind_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_kind_ck"
  CHECK ("kind" IN ('invoice', 'payment', 'credit_note', 'bill', 'contact', 'expense', 'transfer'));
--> statement-breakpoint
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_reference_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_reference_ck" CHECK (
  "lax_reference" ~ '^LAX-(BID|SHOP|ART)-(INV|PAY|CN|BILL|CON|EXP|TRF)-[a-z0-9][a-z0-9_-]{0,63}$'
  AND "lax_reference" LIKE 'LAX-' || CASE "product"
    WHEN 'bid' THEN 'BID' WHEN 'shop' THEN 'SHOP' ELSE 'ART' END
    || '-' || CASE "kind"
    WHEN 'invoice' THEN 'INV' WHEN 'payment' THEN 'PAY' WHEN 'credit_note' THEN 'CN'
    WHEN 'bill' THEN 'BILL' WHEN 'expense' THEN 'EXP' WHEN 'transfer' THEN 'TRF' ELSE 'CON' END
    || '-%'
);
--> statement-breakpoint
ALTER TABLE "accounting_document" DROP CONSTRAINT IF EXISTS "accounting_document_totals_ck";
--> statement-breakpoint
ALTER TABLE "accounting_document" ADD CONSTRAINT "accounting_document_totals_ck" CHECK (
  "net_pence" >= 0 AND "vat_pence" >= 0 AND "gross_pence" = "net_pence" + "vat_pence"
  AND (("kind" = 'contact') = ("gross_pence" = 0 AND "net_pence" = 0))
  AND ("kind" NOT IN ('payment', 'expense', 'transfer') OR "vat_pence" = 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_stripe_account" (
  "stripe_account_id" text PRIMARY KEY NOT NULL,
  "product" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "accounting_stripe_account_id_ck"
    CHECK ("stripe_account_id" ~ '^acct_[A-Za-z0-9]{1,48}$'),
  CONSTRAINT "accounting_stripe_account_product_ck" CHECK ("product" IN ('bid', 'shop', 'lax_art'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_stripe_cursor" (
  "stripe_account_id" text PRIMARY KEY NOT NULL
    REFERENCES "accounting_stripe_account" ("stripe_account_id") ON DELETE RESTRICT,
  "read_through" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_stripe_balance_txn" (
  "stripe_account_id" text NOT NULL
    REFERENCES "accounting_stripe_account" ("stripe_account_id") ON DELETE RESTRICT,
  "balance_transaction_id" text NOT NULL,
  "type" text NOT NULL,
  "currency" text NOT NULL,
  "amount_pence" bigint NOT NULL,
  "fee_pence" bigint NOT NULL,
  "created_at_stripe" timestamp with time zone NOT NULL,
  "created_on" date NOT NULL,
  "source_id" text,
  "payout_id" text,
  "product" text,
  "outcome" text NOT NULL,
  "park_reason" text,
  "booked_fee_pence" bigint DEFAULT 0 NOT NULL,
  "booked_payout_pence" bigint DEFAULT 0 NOT NULL,
  "read_at" timestamp with time zone NOT NULL,
  CONSTRAINT "accounting_stripe_balance_txn_pk"
    PRIMARY KEY ("stripe_account_id", "balance_transaction_id"),
  CONSTRAINT "accounting_stripe_balance_txn_id_ck"
    CHECK ("balance_transaction_id" ~ '^txn_[A-Za-z0-9]{1,48}$'),
  CONSTRAINT "accounting_stripe_balance_txn_type_ck" CHECK ("type" ~ '^[a-z_]{1,64}$'),
  CONSTRAINT "accounting_stripe_balance_txn_currency_ck" CHECK ("currency" ~ '^[a-z]{3}$'),
  CONSTRAINT "accounting_stripe_balance_txn_source_ck"
    CHECK ("source_id" IS NULL OR "source_id" ~ '^[a-z]{1,8}_[A-Za-z0-9]{1,48}$'),
  CONSTRAINT "accounting_stripe_balance_txn_payout_ck"
    CHECK ("payout_id" IS NULL OR "payout_id" ~ '^po_[A-Za-z0-9]{1,48}$'),
  CONSTRAINT "accounting_stripe_balance_txn_product_ck"
    CHECK ("product" IS NULL OR "product" IN ('bid', 'shop', 'lax_art')),
  CONSTRAINT "accounting_stripe_balance_txn_outcome_ck"
    CHECK ("outcome" IN ('booked', 'parked', 'nothing', 'not_aimed')),
  -- Parked rows say why; nothing else does.
  CONSTRAINT "accounting_stripe_balance_txn_park_ck" CHECK (
    ("outcome" = 'parked') = ("park_reason" IS NOT NULL)
    AND ("park_reason" IS NULL OR "park_reason" ~ '^[a-z_]{1,64}$')
  ),
  -- Booked rows name their product and book something; every other row books nothing.
  CONSTRAINT "accounting_stripe_balance_txn_booked_ck" CHECK (
    "booked_fee_pence" >= 0 AND "booked_payout_pence" >= 0
    AND CASE WHEN "outcome" = 'booked'
      THEN "product" IS NOT NULL AND "booked_fee_pence" + "booked_payout_pence" > 0
      ELSE "booked_fee_pence" = 0 AND "booked_payout_pence" = 0 END
    AND ("outcome" <> 'not_aimed' OR "product" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_stripe_balance_txn_day_idx"
  ON "accounting_stripe_balance_txn" ("product", "created_on");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_stripe_balance_txn_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  RAISE EXCEPTION 'accounting_stripe_balance_txn is append-only'
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounting_stripe_balance_txn_append_only" ON "accounting_stripe_balance_txn";
--> statement-breakpoint
CREATE TRIGGER "accounting_stripe_balance_txn_append_only"
  BEFORE UPDATE OR DELETE ON "accounting_stripe_balance_txn"
  FOR EACH ROW EXECUTE FUNCTION "accounting_stripe_balance_txn_append_only"();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_reconciliation_report" (
  "legal_entity" text NOT NULL,
  "report_day" date NOT NULL,
  "storage_key" text NOT NULL,
  "mismatches" integer NOT NULL,
  "generated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "accounting_reconciliation_report_pk" PRIMARY KEY ("legal_entity", "report_day"),
  CONSTRAINT "accounting_reconciliation_report_entity_ck"
    CHECK ("legal_entity" IN ('london_auction_xchange', 'london_art_exchange')),
  CONSTRAINT "accounting_reconciliation_report_key_ck"
    CHECK ("storage_key" ~ '^accounting/reconciliation/[a-z_]+/[0-9]{4}-[0-9]{2}-[0-9]{2}/[A-Za-z0-9._-]+\.json$'),
  CONSTRAINT "accounting_reconciliation_report_mismatches_ck" CHECK ("mismatches" >= 0)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_stripe_shop_order"(p_payment_intent text) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT o."id" FROM public."shop_order" o WHERE o."stripe_payment_intent_id" = p_payment_intent
   ORDER BY o."id" LIMIT 1;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public."accounting_stripe_shop_order"(text) FROM PUBLIC;
