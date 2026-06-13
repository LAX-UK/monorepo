CREATE TABLE IF NOT EXISTS "media_asset" (
  "key" text PRIMARY KEY NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "blur_data_url" text NOT NULL,
  "variants" jsonb,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
