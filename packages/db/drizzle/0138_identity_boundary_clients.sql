ALTER TABLE "shop_user_profile"
  ADD COLUMN IF NOT EXISTS "disabled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "merged_into_subject_id" text;
