DROP INDEX IF EXISTS "bid_user_profile_identity_active_idx";

ALTER TABLE "bid_user_profile"
  DROP COLUMN IF EXISTS "merged_into_subject_id",
  DROP COLUMN IF EXISTS "identity_disabled_at";
