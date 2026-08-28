DROP TABLE IF EXISTS "user_category_interest";
ALTER TABLE "user"
  DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at";
