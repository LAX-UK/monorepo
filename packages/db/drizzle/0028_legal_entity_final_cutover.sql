-- final legal-entity ownership cutover.
--
-- 0027 backfilled these columns and migration flipped reads to fail fast when
-- they are missing. This migration makes the legal-entity ownership columns
-- mandatory and removes deprecated user-id ownership columns that were only
-- present for dual-write compatibility during development.

-- Idempotent backfill for any rows still missing legal entity references
-- (handles case where 0027 ran without bid backfill)
UPDATE "bid" b
SET "buyer_legal_entity_id" = le."id"
FROM "legal_entity" le
WHERE le."created_by_user_id" = b."bidder_id" AND le."kind" = 'individual'
AND b."buyer_legal_entity_id" IS NULL;

ALTER TABLE "lot"
  ALTER COLUMN "seller_legal_entity_id" SET NOT NULL;

ALTER TABLE "bid"
  ALTER COLUMN "buyer_legal_entity_id" SET NOT NULL;

ALTER TABLE "item_submission"
  ALTER COLUMN "legal_entity_id" SET NOT NULL;

ALTER TABLE "payment"
  ALTER COLUMN "buyer_legal_entity_id" SET NOT NULL,
  ALTER COLUMN "seller_legal_entity_id" SET NOT NULL;

ALTER TABLE "sale"
  ALTER COLUMN "created_by_legal_entity_id" SET NOT NULL;

DROP INDEX IF EXISTS "lot_seller_id_idx";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "seller_id";

DROP INDEX IF EXISTS "item_submission_seller_id_idx";
ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "seller_id";

ALTER TABLE "payment" DROP COLUMN IF EXISTS "seller_id";

DROP INDEX IF EXISTS "sale_created_by_idx";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "created_by";
