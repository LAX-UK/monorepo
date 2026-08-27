ALTER TABLE "bid_user_profile"
  ADD COLUMN IF NOT EXISTS "category_interests_onboarding_completed_at" timestamptz;

UPDATE "bid_user_profile" AS profile
SET "category_interests_onboarding_completed_at" = now()
FROM "user" AS identity_user
WHERE profile.user_id = identity_user.id
  AND profile.category_interests_onboarding_completed_at IS NULL
  AND identity_user.created_at < transaction_timestamp();

CREATE TABLE IF NOT EXISTS "user_category_interest" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT,
  "sort_order" integer NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "category_id")
);

CREATE INDEX IF NOT EXISTS "user_category_interest_category_id_idx"
  ON "user_category_interest" ("category_id");
CREATE INDEX IF NOT EXISTS "user_category_interest_user_sort_idx"
  ON "user_category_interest" ("user_id", "sort_order");
