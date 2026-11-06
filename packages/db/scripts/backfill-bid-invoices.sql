-- Backfill of bid invoices for payments that have none. Safe to re-run: it only adds what is
-- missing and links payments that have no invoice yet; invoices and lines that exist are kept.
-- These are the backfill statements of migration 0319_bid_invoice, kept in step by a test. Run it
-- once after deploying the release that raises invoices, to cover payments the previous release
-- created in between:
--   pnpm --filter @auction/db exec tsx scripts/backfill-bid-invoices.ts
-- Then check that this returns 0:
--   select count(*) from payment where invoice_id is null and amount > 0;

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
INSERT INTO "bid_invoice_line" ("invoice_id", "position", "kind", "label", "rate_percent", "amount_pence")
SELECT i."id", 1, 'legacy_total', 'Total', NULL, i."total_pence"
FROM "bid_invoice" i
WHERE i."source" = 'legacy_backfill'
  AND NOT EXISTS (SELECT 1 FROM "bid_invoice_line" x WHERE x."invoice_id" = i."id")
ON CONFLICT ("invoice_id", "position") DO NOTHING;
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
