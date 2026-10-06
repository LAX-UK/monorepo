DROP INDEX IF EXISTS "shop_artist_identity_subject_uid";

ALTER TABLE "shop_artist" DROP COLUMN IF EXISTS "identity_subject_id";
