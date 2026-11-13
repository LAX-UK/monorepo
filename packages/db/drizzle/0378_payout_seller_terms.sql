-- Seller payouts are paid from the seller-terms snapshot: the hammer, less the signed agreement's
-- commission and the VAT on it. Each sale line points at the snapshot it pays, so the payout, the
-- statement and the accounts read one set of figures. A payout keeps the hammer, commission and
-- VAT totals of the sales on it beside its existing totals, which keep their meaning: gross is the
-- hammer total for new payouts and platform_fee is commission plus VAT. A refund line keeps the
-- buyer's refund it answers for, because the seller is charged back only their share of it.
-- Sign convention of buyer_refund_pence: zero or more on a line charging a buyer refund (amount
-- zero or below, or a true-up credit answering for nothing new); negative on a line giving back a
-- buyer refund that failed (the refund it reverses, amount zero or more). Every sum over the lines
-- is signed, so a give-back cancels the charge it reverses.
-- Additive: nullable columns that nothing reads until the new release is running. Two guards come
-- with it: the top-up of the buyer's refund record reads what a refund line answered for, and a
-- seller-terms row may be re-priced only while it is held.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "payout_line"
  ADD COLUMN IF NOT EXISTS "seller_terms_id" uuid,
  ADD COLUMN IF NOT EXISTS "buyer_refund_pence" bigint;
--> statement-breakpoint
ALTER TABLE "payout"
  ADD COLUMN IF NOT EXISTS "hammer_amount" numeric(18, 2),
  ADD COLUMN IF NOT EXISTS "commission_amount" numeric(18, 2),
  ADD COLUMN IF NOT EXISTS "commission_vat_amount" numeric(18, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_seller_terms_id_fkey') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_seller_terms_id_fkey"
      FOREIGN KEY ("seller_terms_id") REFERENCES "sale_seller_terms"("id") ON DELETE RESTRICT;
  END IF;
  -- Only a lot's sale line pays a snapshot.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_seller_terms_sale_ck') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_seller_terms_sale_ck" CHECK (
        "seller_terms_id" IS NULL OR ("kind" = 'sale' AND "payment_id" IS NOT NULL)
      );
  END IF;
  -- Only a refund line answers for a buyer's refund. A negative one is a failed refund given
  -- back, so it never takes money from the seller.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_line_buyer_refund_ck') THEN
    ALTER TABLE "payout_line"
      ADD CONSTRAINT "payout_line_buyer_refund_ck" CHECK (
        "buyer_refund_pence" IS NULL OR (
          "kind" = 'refund' AND ("buyer_refund_pence" >= 0 OR "amount" >= 0)
        )
      );
  END IF;
  -- The three seller-terms totals are written together, and never below zero.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_seller_terms_totals_ck') THEN
    ALTER TABLE "payout"
      ADD CONSTRAINT "payout_seller_terms_totals_ck" CHECK (
        ("hammer_amount" IS NULL AND "commission_amount" IS NULL AND "commission_vat_amount" IS NULL)
        OR (
          "hammer_amount" IS NOT NULL AND "commission_amount" IS NOT NULL
          AND "commission_vat_amount" IS NOT NULL
          AND "hammer_amount" >= 0 AND "commission_amount" >= 0 AND "commission_vat_amount" >= 0
        )
      );
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payout_line_seller_terms_idx"
  ON "payout_line" ("seller_terms_id") WHERE "seller_terms_id" IS NOT NULL;
--> statement-breakpoint
-- The top-up of the buyer's refund record (0344, signed by 0376), reading each refund line's buyer
-- refund where the line keeps it. A line since this release can charge less than the buyer's refund
-- (the seller's share), nothing (a share already taken back), or give back part of a charge made in
-- full before this release; only what it answered for says what the buyer was refunded, and a line
-- giving back a failed refund answers for it as a negative figure, so it cancels the charge. A line
-- that keeps no buyer refund counts its amount with its sign, as 0376 does: a charge was the
-- buyer's refund, and a compensating line (a failed refund given back) cancels the line it
-- corrects, so those rows top up exactly as they did after 0376.
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
      SUM(COALESCE(l."buyer_refund_pence", round(-l."amount" * 100)))::bigint AS "line_pence",
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
--> statement-breakpoint
-- Settlement may store figures over a held row only (the grant is on the figure columns; this is
-- the row). A snapshot that is priced has been, or will be, paid from, and later clawbacks are
-- read from it, so it is never rewritten, by any role, the owner included.
CREATE OR REPLACE FUNCTION "sale_seller_terms_reprice_held_only"() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD."basis" = 'held' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'sale_seller_terms row % is %: only a held row is priced again', OLD."id", OLD."basis"
    USING ERRCODE = 'restrict_violation';
END;
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "sale_seller_terms_reprice_held_only" ON "sale_seller_terms";
--> statement-breakpoint
CREATE TRIGGER "sale_seller_terms_reprice_held_only"
  BEFORE UPDATE ON "sale_seller_terms"
  FOR EACH ROW EXECUTE FUNCTION "sale_seller_terms_reprice_held_only"();
