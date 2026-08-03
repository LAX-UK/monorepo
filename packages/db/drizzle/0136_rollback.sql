ALTER TABLE "sale" DROP COLUMN IF EXISTS "hero_video_url";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "hero_presentation";
DROP TYPE IF EXISTS "public"."sale_hero_presentation";
