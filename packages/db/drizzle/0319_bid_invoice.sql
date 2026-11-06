-- Store each Bid invoice and its lines, so every surface (the Pay page, Stripe, the invoice PDF,
-- the staff overdue list) reads one set of figures and one due date. An invoice is raised once for
-- a lot and buyer account and outlives payment retries: a payment row cancelled or expired and
-- raised again points at the same invoice, so the due date does not restart. Amounts are whole
-- pence in pounds sterling.
--
-- Existing payments are backfilled idempotently (the same statements are in
-- packages/db/scripts/backfill-bid-invoices.sql, to run again after a deploy), one invoice per lot and buyer account:
--   * raised_at is the earliest payment row's created_at, due_at is the end of the London day
--     seven days after the London day it was raised (the same rule as invoiceDueAt in the app);
--   * the total is the amount of the live (or latest) payment row;
--   * the lines are the hammer price and the buyer's premium when the total covers the hammer
--     price, otherwise one legacy_total line; the invoice is flagged legacy_backfill;
--   * an invoice whose purchase was cancelled by a buyer default is voided.
-- Additive: two tables and a nullable column on payment, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_invoice" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "seller_legal_entity_id" uuid NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "total_pence" bigint NOT NULL,
  "raised_at" timestamp with time zone NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "pricing_policy_id" text,
  "number" text,
  "source" text DEFAULT 'raised' NOT NULL,
  "voided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "bid_invoice_currency_check" CHECK ("currency" = 'GBP'),
  CONSTRAINT "bid_invoice_total_check" CHECK ("total_pence" > 0),
  CONSTRAINT "bid_invoice_source_check" CHECK ("source" IN ('raised', 'legacy_backfill')),
  CONSTRAINT "bid_invoice_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "bid_invoice_buyer_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "bid_invoice_seller_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("seller_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_invoice_lot_buyer_live_uidx"
  ON "bid_invoice" ("lot_id", "buyer_legal_entity_id")
  WHERE "voided_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_invoice_buyer_legal_entity_id_idx"
  ON "bid_invoice" ("buyer_legal_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_invoice_due_at_idx"
  ON "bid_invoice" ("due_at")
  WHERE "voided_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_invoice_number_uidx"
  ON "bid_invoice" ("number")
  WHERE "number" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_invoice_line" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "position" smallint NOT NULL,
  "kind" text NOT NULL,
  "label" text NOT NULL,
  "rate_percent" numeric(6, 3),
  "amount_pence" bigint NOT NULL,
  CONSTRAINT "bid_invoice_line_kind_check" CHECK (
    "kind" IN (
      'hammer', 'buyers_premium', 'vat_on_hammer', 'import_vat',
      'artists_resale_right', 'delivery', 'legacy_total'
    )
  ),
  CONSTRAINT "bid_invoice_line_amount_check" CHECK ("amount_pence" >= 0),
  CONSTRAINT "bid_invoice_line_invoice_id_bid_invoice_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."bid_invoice"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "bid_invoice_line_invoice_position_uidx"
  ON "bid_invoice_line" ("invoice_id", "position");
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN IF NOT EXISTS "invoice_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment"
    ADD CONSTRAINT "payment_invoice_id_bid_invoice_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."bid_invoice"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_invoice_id_idx"
  ON "payment" ("invoice_id")
  WHERE "invoice_id" IS NOT NULL;
--> statement-breakpoint
-- Backfill: one invoice per lot and buyer account that has any payment row. The live or settled
-- row decides the total (a cancelled row only when nothing else exists), the earliest row decides
-- the raised date.
INSERT INTO "bid_invoice" (
  "lot_id", "buyer_legal_entity_id", "seller_legal_entity_id", "total_pence",
  "raised_at", "due_at", "source", "voided_at"
)
SELECT
  pick."lot_id",
  pick."buyer_legal_entity_id",
  pick."seller_legal_entity_id",
  round(pick."amount" * 100)::bigint,
  span."raised_at",
  ((((span."raised_at" AT TIME ZONE 'Europe/London')::date + 8)::timestamp
      AT TIME ZONE 'Europe/London') - interval '1 millisecond'),
  'legacy_backfill',
  bd."created_at"
FROM (
  SELECT DISTINCT ON ("lot_id", "buyer_legal_entity_id")
    "lot_id", "buyer_legal_entity_id", "seller_legal_entity_id", "amount"
  FROM "payment"
  WHERE "amount" > 0
  ORDER BY
    "lot_id", "buyer_legal_entity_id",
    CASE WHEN "status" = 'cancelled' THEN 1 ELSE 0 END,
    "created_at" DESC,
    "id"
) AS pick
JOIN (
  SELECT "lot_id", "buyer_legal_entity_id", min("created_at") AS "raised_at"
  FROM "payment"
  GROUP BY "lot_id", "buyer_legal_entity_id"
) AS span
  ON span."lot_id" = pick."lot_id"
 AND span."buyer_legal_entity_id" = pick."buyer_legal_entity_id"
LEFT JOIN LATERAL (
  SELECT "created_at"
  FROM "buyer_default"
  WHERE "buyer_default"."lot_id" = pick."lot_id"
    AND "buyer_default"."buyer_legal_entity_id" = pick."buyer_legal_entity_id"
  ORDER BY "created_at" DESC
  LIMIT 1
) AS bd ON true
WHERE NOT EXISTS (
  SELECT 1 FROM "bid_invoice" x
  WHERE x."lot_id" = pick."lot_id"
    AND x."buyer_legal_entity_id" = pick."buyer_legal_entity_id"
)
ON CONFLICT ("lot_id", "buyer_legal_entity_id") WHERE "voided_at" IS NULL DO NOTHING;
--> statement-breakpoint
-- Lines for backfilled invoices that have none yet: hammer price and buyer's premium when the
-- total covers the hammer price, otherwise one total.
INSERT INTO "bid_invoice_line" ("invoice_id", "position", "kind", "label", "rate_percent", "amount_pence")
SELECT i."id", 1, 'hammer', 'Hammer price', NULL, h."hammer_pence"
FROM "bid_invoice" i
JOIN "lot" l ON l."id" = i."lot_id"
CROSS JOIN LATERAL (SELECT round(l."current_price" * 100)::bigint AS "hammer_pence") h
WHERE i."source" = 'legacy_backfill'
  AND h."hammer_pence" > 0
  AND i."total_pence" >= h."hammer_pence"
  AND NOT EXISTS (SELECT 1 FROM "bid_invoice_line" x WHERE x."invoice_id" = i."id")
ON CONFLICT ("invoice_id", "position") DO NOTHING;
--> statement-breakpoint
INSERT INTO "bid_invoice_line" ("invoice_id", "position", "kind", "label", "rate_percent", "amount_pence")
SELECT i."id", 2, 'buyers_premium', 'Buyer''s premium', NULL, i."total_pence" - h."hammer_pence"
FROM "bid_invoice" i
JOIN "lot" l ON l."id" = i."lot_id"
CROSS JOIN LATERAL (SELECT round(l."current_price" * 100)::bigint AS "hammer_pence") h
WHERE i."source" = 'legacy_backfill'
  AND h."hammer_pence" > 0
  AND i."total_pence" > h."hammer_pence"
  AND EXISTS (
    SELECT 1 FROM "bid_invoice_line" x
    WHERE x."invoice_id" = i."id" AND x."position" = 1 AND x."kind" = 'hammer'
  )
  AND NOT EXISTS (
    SELECT 1 FROM "bid_invoice_line" x WHERE x."invoice_id" = i."id" AND x."position" = 2
  )
ON CONFLICT ("invoice_id", "position") DO NOTHING;
--> statement-breakpoint
INSERT INTO "bid_invoice_line" ("invoice_id", "position", "kind", "label", "rate_percent", "amount_pence")
SELECT i."id", 1, 'legacy_total', 'Total', NULL, i."total_pence"
FROM "bid_invoice" i
WHERE i."source" = 'legacy_backfill'
  AND NOT EXISTS (SELECT 1 FROM "bid_invoice_line" x WHERE x."invoice_id" = i."id")
ON CONFLICT ("invoice_id", "position") DO NOTHING;
--> statement-breakpoint
-- Every payment row without an invoice points at the pair's live invoice, or, when the purchase
-- was voided, at its latest invoice.
UPDATE "payment" p
SET "invoice_id" = (
  SELECT i."id"
  FROM "bid_invoice" i
  WHERE i."lot_id" = p."lot_id"
    AND i."buyer_legal_entity_id" = p."buyer_legal_entity_id"
  ORDER BY (i."voided_at" IS NULL) DESC, i."created_at" DESC, i."id"
  LIMIT 1
)
WHERE p."invoice_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "bid_invoice" i
    WHERE i."lot_id" = p."lot_id"
      AND i."buyer_legal_entity_id" = p."buyer_legal_entity_id"
  );
