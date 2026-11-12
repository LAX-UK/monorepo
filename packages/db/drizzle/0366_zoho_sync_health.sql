-- Zoho sync health for LAX Admin: one row the worker keeps with the sync modes it runs with and how
-- the OAuth token refresh is doing, so staff can see a broken connection without reading logs. An
-- index lets "deleted in Zoho" find a Product's newest result without reading every pass.
-- Additive: the running release neither reads nor writes either.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_sync_health" (
  "id" text PRIMARY KEY DEFAULT 'zoho' NOT NULL,
  "artwork_sync_mode" text,
  "listing_mode" text,
  "modes_reported_at" timestamp with time zone,
  "token_refreshed_at" timestamp with time zone,
  "token_expires_at" timestamp with time zone,
  "token_failure_streak" integer DEFAULT 0 NOT NULL,
  "token_last_failure_at" timestamp with time zone,
  "token_last_failure_code" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_sync_health_single_row_check" CHECK ("id" = 'zoho'),
  CONSTRAINT "zoho_sync_health_modes_check" CHECK (
    ("artwork_sync_mode" IS NULL OR "artwork_sync_mode" IN ('off', 'dry_run', 'live'))
    AND ("listing_mode" IS NULL OR "listing_mode" IN ('off', 'dry_run', 'live'))
  ),
  CONSTRAINT "zoho_sync_health_streak_check" CHECK ("token_failure_streak" >= 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zoho_artwork_sync_outcome_product_recorded_idx"
  ON "zoho_artwork_sync_outcome" ("zoho_product_id", "recorded_at" DESC, "id" DESC);
