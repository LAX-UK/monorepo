-- IRREVERSIBLE (rollback cannot restore): fulfilment backfill, payout blocked_reason, LAX grants, edition de-authorisation.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$
DECLARE
  "lax_count" integer;
BEGIN
  SELECT COUNT(*)::integer INTO "lax_count" FROM "shop_party" WHERE "kind" = 'lax';
  IF "lax_count" > 1 THEN
    RAISE EXCEPTION '0193: expected at most one shop_party with kind=lax, found %', "lax_count";
  END IF;
  IF "lax_count" = 0 THEN
    INSERT INTO "shop_party" ("display_name", "kind")
    VALUES ('LAX London Art Exchange', 'lax');
  END IF;
END $$;
--> statement-breakpoint
-- Release duplicate active holds (keep earliest per edition) before unique partial index.
WITH "ranked" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "edition_id" ORDER BY "created_at" ASC) AS "rn"
  FROM "shop_stock_hold"
  WHERE "status" = 'active'
)
UPDATE "shop_stock_hold" AS "h"
SET
  "status" = 'released',
  "released_at" = NOW()
FROM "ranked" AS "r"
WHERE "h"."id" = "r"."id"
  AND "r"."rn" > 1;
--> statement-breakpoint
DROP INDEX IF EXISTS "shop_stock_hold_edition_active_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_stock_hold_edition_active_uid"
  ON "shop_stock_hold" ("edition_id")
  WHERE "status" = 'active';
--> statement-breakpoint
-- Paid orders created before fulfilment-on-pay need a row for possession updates.
INSERT INTO "shop_fulfilment" ("order_id", "option", "status")
SELECT
  "o"."id",
  "o"."fulfilment",
  'pending_production'::"shop_fulfilment_status"
FROM "shop_order" AS "o"
WHERE "o"."status" = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM "shop_fulfilment" AS "f" WHERE "f"."order_id" = "o"."id"
  );
--> statement-breakpoint
-- Legacy payouts without possession must stay blocked (0182 auto-dates are unsafe).
UPDATE "shop_payout_ledger" AS "pl"
SET
  "blocked_reason" = 'pending_possession',
  "cancellation_period_ends_at" = NULL
WHERE "pl"."blocked_reason" IS NULL
  AND "pl"."status" = 'pending_refund_period'
  AND EXISTS (
    SELECT 1
    FROM "shop_order_line" AS "ol"
    JOIN "shop_order" AS "o" ON "o"."id" = "ol"."order_id"
    LEFT JOIN "shop_fulfilment" AS "f" ON "f"."order_id" = "o"."id"
    WHERE "ol"."id" = "pl"."order_line_id"
      AND ("f"."id" IS NULL OR "f"."possession_at" IS NULL)
  );
--> statement-breakpoint
-- Backfill LAX owner on editions missing owner_party_id (before grant insert; excludes sold).
UPDATE "shop_edition" AS "e"
SET "owner_party_id" = "lax"."id"
FROM (
  SELECT "id"
  FROM "shop_party"
  WHERE "kind" = 'lax'
  ORDER BY "id"
  LIMIT 1
) AS "lax"
WHERE "e"."owner_party_id" IS NULL
  AND "e"."allocation" = 'lax'
  AND "e"."listing_status" <> 'sold'::"shop_edition_listing_status";
--> statement-breakpoint
-- Preserve LAX platform stock: record explicit grants before undoing 0182 implicit authorisation.
INSERT INTO "shop_sale_authority_grant" (
  "artwork_id",
  "owner_party_id",
  "authorised_count",
  "recorded_by_subject_id",
  "evidence_note"
)
SELECT
  "e"."artwork_id",
  "e"."owner_party_id",
  COUNT(*)::integer,
  'migration-0193',
  'Migration 0193: explicit LAX platform sale authority (replaces 0182 implicit grant)'
FROM "shop_edition" AS "e"
INNER JOIN "shop_party" AS "p" ON "p"."id" = "e"."owner_party_id" AND "p"."kind" = 'lax'
WHERE "e"."listing_status" = 'authorised'
  AND NOT EXISTS (
    SELECT 1
    FROM "shop_sale_authority_grant" AS "g"
    WHERE "g"."artwork_id" = "e"."artwork_id"
      AND "g"."owner_party_id" = "e"."owner_party_id"
  )
GROUP BY "e"."artwork_id", "e"."owner_party_id";
--> statement-breakpoint
-- Undo 0182 implicit authorisation: require an explicit grant for owner+artwork.
UPDATE "shop_edition" AS "e"
SET
  "listing_status" = 'not_authorised',
  "sale_authorised_at" = NULL
WHERE "e"."listing_status" = 'authorised'
  AND "e"."owner_party_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "shop_sale_authority_grant" AS "g"
    WHERE "g"."artwork_id" = "e"."artwork_id"
      AND "g"."owner_party_id" = "e"."owner_party_id"
  );
--> statement-breakpoint
-- Reconcile authorised editions to the effective grant count (latest revision per artwork+owner).
WITH "latest_grant" AS (
  SELECT DISTINCT ON ("artwork_id", "owner_party_id")
    "artwork_id",
    "owner_party_id",
    "authorised_count"
  FROM "shop_sale_authority_grant"
  ORDER BY "artwork_id", "owner_party_id", "revision" DESC
),
"ranked" AS (
  SELECT
    "e"."id",
    ROW_NUMBER() OVER (
      PARTITION BY "e"."artwork_id", "e"."owner_party_id"
      ORDER BY "e"."edition_number" DESC
    ) AS "rn",
    "g"."authorised_count"
  FROM "shop_edition" AS "e"
  INNER JOIN "latest_grant" AS "g"
    ON "g"."artwork_id" = "e"."artwork_id"
    AND "g"."owner_party_id" = "e"."owner_party_id"
  WHERE "e"."listing_status" = 'authorised'
)
UPDATE "shop_edition" AS "e"
SET
  "listing_status" = 'not_authorised',
  "sale_authorised_at" = NULL
FROM "ranked" AS "r"
WHERE "e"."id" = "r"."id"
  AND "r"."rn" > "r"."authorised_count";
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "shop_edition"
    WHERE "listing_status" = 'authorised'
      AND "owner_party_id" IS NULL
  ) THEN
    RAISE EXCEPTION '0193: authorised edition without owner after LAX backfill';
  END IF;
END $$;
