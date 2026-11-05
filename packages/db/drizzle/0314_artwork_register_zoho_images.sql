-- Zoho pictures in the artwork register: the register keeps, for each picture, the Zoho file it came
-- from and the stored copy it became, and when the pictures were last compared with Zoho's. Both are
-- new columns with defaults, so existing rows are valid as they are (no pictures, never checked).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "artwork_register"
  ADD COLUMN IF NOT EXISTS "image_sources" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "artwork_register"
  ADD COLUMN IF NOT EXISTS "images_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "artwork_register"
  ADD CONSTRAINT "artwork_register_image_sources_array" CHECK (jsonb_typeof("image_sources") = 'array');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "artwork_register_images_checked_idx"
  ON "artwork_register" ("images_checked_at" NULLS FIRST);
