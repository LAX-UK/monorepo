DROP INDEX IF EXISTS "shop_artwork_interest_unsubscribe_token_uid";

DROP INDEX IF EXISTS "shop_artwork_interest_alert_email_idx";

DROP INDEX IF EXISTS "shop_artwork_interest_alert_email_uid";

DROP INDEX IF EXISTS "shop_artwork_interest_alert_subject_uid";

DROP INDEX IF EXISTS "shop_artwork_interest_enquiry_subject_uid";

-- The restored index allows one row per account and intent, so stopped alerts go first and only
-- the latest of any remaining repeats is kept.
DELETE FROM "shop_artwork_interest" WHERE "intent" = 'notify_me' AND "cancelled_at" IS NOT NULL;

DELETE FROM "shop_artwork_interest" AS doomed
USING (
  SELECT "id", row_number() OVER (
    PARTITION BY "artwork_id", "identity_subject_id", "intent"
    ORDER BY "created_at" DESC, "id" DESC
  ) AS position
  FROM "shop_artwork_interest"
  WHERE "identity_subject_id" IS NOT NULL
) AS ranked
WHERE doomed."id" = ranked."id" AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "shop_artwork_interest_artwork_subject_intent_uid" ON "shop_artwork_interest" USING btree ("artwork_id","identity_subject_id","intent");

ALTER TABLE "shop_artwork_interest" DROP CONSTRAINT IF EXISTS "shop_artwork_interest_alert_columns_ck";

ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "unsubscribe_token_hash";

ALTER TABLE "shop_artwork_interest" DROP COLUMN IF EXISTS "cancelled_at";
