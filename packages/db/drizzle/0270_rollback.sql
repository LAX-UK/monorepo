-- Rollback for 0270_sale_cover_slots. Roll back the application release first: the previous
-- release neither reads nor writes these fields. Cover slots, subtitles, featured lots, home
-- pins, consignment deadlines, framed sizes and every cover analysis are lost. The pictures in
-- cover_images and lot.images are untouched, so the old cover array keeps working.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "cover_analysis";

ALTER TABLE "lot" DROP CONSTRAINT IF EXISTS "lot_framed_size_check";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "framed_height_cm";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "framed_width_cm";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "photo_includes_frame";

DROP INDEX IF EXISTS "sale_home_pin_order_uid";
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_home_pin_order_range";
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_featured_lot_ids_max";
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_subtitle_length";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "consignment_deadline";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "home_pin_order";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "featured_lot_ids";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "subtitle";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "cover_slots";
