-- Cover art direction for the home hero, and the fields the home page reads.
--   sale.cover_slots: named slots (default, wide, phone) with focal point, keep-in-frame area,
--     zoom, alt text and overrides. A missing slot falls back to its position in cover_images.
--   sale.subtitle, featured_lot_ids, home_pin_order, consignment_deadline: what staff choose.
--   lot.photo_includes_frame, framed_width_cm, framed_height_cm: true-scale hanging with frames.
--   cover_analysis: what the worker measures from a cover picture (colours, blur preview and the
--     scrim that keeps text readable), keyed by the fingerprint of picture, crop and text side.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "cover_slots" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "subtitle" text;
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "featured_lot_ids" uuid[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "home_pin_order" smallint;
--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN IF NOT EXISTS "consignment_deadline" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_subtitle_length";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_subtitle_length" CHECK (char_length("subtitle") <= 160);
--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_featured_lot_ids_max";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_featured_lot_ids_max" CHECK (cardinality("featured_lot_ids") <= 12);
--> statement-breakpoint
ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_home_pin_order_range";
--> statement-breakpoint
ALTER TABLE "sale" ADD CONSTRAINT "sale_home_pin_order_range"
  CHECK ("home_pin_order" IS NULL OR "home_pin_order" BETWEEN 1 AND 3);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sale_home_pin_order_uid"
  ON "sale" ("home_pin_order") WHERE "home_pin_order" IS NOT NULL AND "deleted_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "photo_includes_frame" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "framed_width_cm" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "framed_height_cm" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "lot" DROP CONSTRAINT IF EXISTS "lot_framed_size_check";
--> statement-breakpoint
ALTER TABLE "lot" ADD CONSTRAINT "lot_framed_size_check" CHECK (
  ("framed_width_cm" IS NULL) = ("framed_height_cm" IS NULL)
  AND ("framed_width_cm" IS NULL OR ("framed_width_cm" > 0 AND "framed_height_cm" > 0))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cover_analysis" (
  "hash" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "analysis" jsonb,
  "analysed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "cover_analysis_status_check" CHECK ("status" IN ('ready', 'failed')),
  CONSTRAINT "cover_analysis_ready_has_analysis" CHECK (("status" = 'ready') = ("analysis" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cover_analysis_analysed_at_idx" ON "cover_analysis" ("analysed_at");
