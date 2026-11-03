-- Zoho artwork inbound sync: where each pass stands, and what each pass found.
--   zoho_artwork_sync_state   the newest Zoho modified time already read, one row per mode, so a
--                             nightly check reads only what changed and a switch from dry run to
--                             live starts with a full pass of its own.
--   zoho_artwork_sync_outcome the result for each Product in a pass: what was (or in dry run
--                             would be) created, updated, left as a conflict, ignored or skipped,
--                             and why. This is the dry-run import report.
-- Additive: the running release does not read these tables.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_artwork_sync_state" (
  "mode" text PRIMARY KEY NOT NULL,
  "watermark" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_artwork_sync_state_mode_check" CHECK ("mode" IN ('dry_run', 'live'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_artwork_sync_outcome" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" text NOT NULL,
  "mode" text NOT NULL,
  "zoho_product_id" text NOT NULL,
  "stock_code" text,
  "title" text,
  "outcome" text NOT NULL,
  "reason" text,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "zoho_modified_at" timestamp with time zone,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_artwork_sync_outcome_mode_check" CHECK ("mode" IN ('dry_run', 'live')),
  CONSTRAINT "zoho_artwork_sync_outcome_outcome_check" CHECK (
    "outcome" IN ('create', 'update', 'conflict', 'unchanged', 'stale', 'skipped')
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "zoho_artwork_sync_outcome_run_product_uid"
  ON "zoho_artwork_sync_outcome" ("run_id", "zoho_product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zoho_artwork_sync_outcome_recorded_idx"
  ON "zoho_artwork_sync_outcome" ("recorded_at" DESC, "id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zoho_artwork_sync_outcome_outcome_idx"
  ON "zoho_artwork_sync_outcome" ("run_id", "outcome");
