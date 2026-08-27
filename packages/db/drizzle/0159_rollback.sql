DROP TABLE IF EXISTS "user_category_interest";
ALTER TABLE "bid_user_profile"
  DROP COLUMN IF EXISTS "category_interests_onboarding_completed_at";
