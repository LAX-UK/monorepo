-- "Download my data": Identity owns each person's request for a copy of their data.
--   subject_data_export: one row per request, its state, per-product progress, the legal due
--     date, the stored file's key, size and hash, and the expiry. A partial unique index allows
--     one open request per person even under concurrent requests.
--   subject_data_export_audit: append-only record of what happened to each request (ids, counts,
--     sizes, hashes, addresses and times; never record content).
-- The request keeps its record if the user row is ever hard-deleted (the foreign key sets the
-- subject to null), so proof that a request was answered survives; the audit table holds the
-- subject as plain text with no foreign key to the user.
-- Additive: two new tables, so the running services keep working until they restart.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_data_export" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "status" text DEFAULT 'requested' NOT NULL,
  "product_progress" jsonb NOT NULL,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "due_at" timestamp with time zone NOT NULL,
  "ready_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "deleted_at" timestamp with time zone,
  "object_key" text,
  "file_name" text,
  "size_bytes" bigint,
  "sha256" text,
  "download_count" integer DEFAULT 0 NOT NULL,
  "last_error_code" text,
  "deadline_alert_tier" integer DEFAULT 0 NOT NULL,
  "object_purge_requested_at" timestamp with time zone,
  "object_purged_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subject_data_export_status_valid" CHECK (
    "status" IN ('requested','collecting','delayed','ready','expired','deleted','failed')
  ),
  CONSTRAINT "subject_data_export_ready_has_file" CHECK (
    "status" <> 'ready' OR ("object_key" IS NOT NULL AND "expires_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subject_data_export_one_open_uidx"
  ON "subject_data_export" ("subject_id")
  WHERE "status" IN ('requested','collecting','delayed','ready');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_export_subject_requested_idx"
  ON "subject_data_export" ("subject_id", "requested_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_export_expiry_idx"
  ON "subject_data_export" ("expires_at") WHERE "status" = 'ready';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_export_purge_idx"
  ON "subject_data_export" ("object_purge_requested_at")
  WHERE "object_purge_requested_at" IS NOT NULL AND "object_purged_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subject_data_export_audit" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "export_id" uuid NOT NULL REFERENCES "subject_data_export"("id") ON DELETE CASCADE,
  "subject_id" text,
  "event" text NOT NULL,
  "session_id" text,
  "ip_address" text,
  "user_agent" text,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subject_data_export_audit_export_idx"
  ON "subject_data_export_audit" ("export_id", "occurred_at");
