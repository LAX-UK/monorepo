ALTER TABLE "shop_artist"
  ADD COLUMN IF NOT EXISTS "identity_subject_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_identity_subject_uid"
  ON "shop_artist" ("identity_subject_id")
  WHERE "identity_subject_id" IS NOT NULL;
