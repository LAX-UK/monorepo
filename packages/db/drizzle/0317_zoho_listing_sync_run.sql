-- LAX listing on Zoho Products: the result of each nightly pass that checks every original's
-- listing in Zoho against LAX and corrects drift, so LAX Admin's "Last check" can show it.
-- Additive: the running release does not read this table.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_listing_sync_run" (
  "run_id" text PRIMARY KEY NOT NULL,
  "mode" text NOT NULL,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone NOT NULL,
  "checked" integer NOT NULL,
  "changed" integer NOT NULL,
  "unchanged" integer NOT NULL,
  "failed" integer NOT NULL,
  "failures" jsonb DEFAULT '[]'::jsonb NOT NULL,
  CONSTRAINT "zoho_listing_sync_run_mode_check" CHECK ("mode" IN ('dry_run', 'live')),
  CONSTRAINT "zoho_listing_sync_run_counts_check" CHECK (
    "checked" >= 0 AND "changed" >= 0 AND "unchanged" >= 0 AND "failed" >= 0
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zoho_listing_sync_run_finished_idx"
  ON "zoho_listing_sync_run" ("finished_at" DESC);
