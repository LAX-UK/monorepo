ALTER TABLE "bid_user_profile"
  ADD COLUMN IF NOT EXISTS "identity_disabled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "merged_into_subject_id" text;

UPDATE "bid_user_profile" AS p
SET
  "identity_disabled_at" = u."identity_disabled_at",
  "merged_into_subject_id" = u."merged_into_subject_id",
  "updated_at" = now()
FROM "user" AS u
WHERE u."id" = p."user_id"
  AND (
    u."identity_disabled_at" IS NOT NULL
    OR u."merged_into_subject_id" IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS "bid_user_profile_identity_active_idx"
  ON "bid_user_profile" ("user_id")
  WHERE "identity_disabled_at" IS NULL AND "merged_into_subject_id" IS NULL;
