ALTER TABLE "user_ui_preference" ADD COLUMN IF NOT EXISTS "view_lots_default" text DEFAULT 'auto' NOT NULL;
ALTER TABLE "user_ui_preference" ADD COLUMN IF NOT EXISTS "view_artists_default" text DEFAULT 'auto' NOT NULL;
ALTER TABLE "user_ui_preference" ADD COLUMN IF NOT EXISTS "view_sales_default" text DEFAULT 'auto' NOT NULL;
ALTER TABLE "user_ui_preference" ADD COLUMN IF NOT EXISTS "density" text DEFAULT 'comfortable' NOT NULL;
ALTER TABLE "user_ui_preference" ADD COLUMN IF NOT EXISTS "view_sync" boolean DEFAULT false NOT NULL;
