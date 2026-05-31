-- Expand artist_kind taxonomy to cover all auction-house collecting categories.
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'designer';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'studio';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'manufacturer';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'coachbuilder';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'author';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'publisher';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'printer';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'mint';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'issuing_authority';--> statement-breakpoint
ALTER TYPE "artist_kind" ADD VALUE IF NOT EXISTS 'producer';--> statement-breakpoint

-- Typed columns for faceted / SEO-relevant fields.
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "country_code" text;--> statement-breakpoint
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "founded_year" text;--> statement-breakpoint
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "dissolved_year" text;--> statement-breakpoint
ALTER TABLE "artist_profile" ADD COLUMN IF NOT EXISTS "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "artist_profile_country_code_idx" ON "artist_profile" ("country_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artist_profile_attributes_gin_idx" ON "artist_profile" USING gin ("attributes");--> statement-breakpoint

-- Creator <-> category (department) join table; shares the lot category taxonomy.
CREATE TABLE IF NOT EXISTS "artist_categories" (
  "artist_profile_id" uuid NOT NULL REFERENCES "artist_profile"("id") ON DELETE CASCADE,
  "category_id" uuid NOT NULL REFERENCES "category"("id") ON DELETE RESTRICT,
  "sort_order" integer NOT NULL DEFAULT 0,
  CONSTRAINT "artist_categories_pk" PRIMARY KEY ("artist_profile_id", "category_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artist_categories_category_id_idx" ON "artist_categories" ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artist_categories_profile_sort_order_idx" ON "artist_categories" ("artist_profile_id", "sort_order");--> statement-breakpoint

-- Best-effort backfill: attach existing person-kind profiles to a fine-art
-- category when one exists and the profile has no category yet. No-op if the
-- taxonomy has no matching category.
INSERT INTO "artist_categories" ("artist_profile_id", "category_id")
SELECT ap."id", c."id"
FROM "artist_profile" ap
CROSS JOIN LATERAL (
  SELECT cat."id"
  FROM "category" cat
  WHERE cat."archived" = false
    AND (
      lower(cat."slug") IN ('fine-art', 'art', 'paintings', 'fine-art-paintings')
      OR lower(cat."name") LIKE '%fine art%'
    )
  ORDER BY cat."sort_order" ASC
  LIMIT 1
) c
WHERE ap."kind" IN ('artist', 'maker')
ON CONFLICT DO NOTHING;
