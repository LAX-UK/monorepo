-- Rollback for 0306_artwork_register_zoho_images. Roll back the application release first.
-- The register keeps image_refs (the stored keys), so listings keep their pictures; only the record
-- of which Zoho file each came from is dropped, and the next check reads Zoho again.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "artwork_register_images_checked_idx";
ALTER TABLE "artwork_register" DROP CONSTRAINT IF EXISTS "artwork_register_image_sources_array";
ALTER TABLE "artwork_register" DROP COLUMN IF EXISTS "images_checked_at";
ALTER TABLE "artwork_register" DROP COLUMN IF EXISTS "image_sources";
