DROP TABLE IF EXISTS "artist_categories";
DROP INDEX IF EXISTS "artist_profile_attributes_gin_idx";
DROP INDEX IF EXISTS "artist_profile_country_code_idx";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "attributes";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "dissolved_year";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "founded_year";
ALTER TABLE "artist_profile" DROP COLUMN IF EXISTS "country_code";
-- Note: PostgreSQL cannot drop values from an enum type. The additional
-- "artist_kind" values introduced by 0087 are intentionally left in place.
