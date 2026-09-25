ALTER TABLE "bid_user_profile"
  ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "terms_version" text;

UPDATE "bid_user_profile"
SET
  "terms_accepted_at" = COALESCE("terms_accepted_at", "created_at"),
  "terms_version" = COALESCE("terms_version", 'legacy');
