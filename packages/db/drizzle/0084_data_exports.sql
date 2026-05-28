CREATE TABLE IF NOT EXISTS "data_exports" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "user_role" text NOT NULL,
  "user_staff_role" text,
  "entity_type" text NOT NULL,
  "format" text DEFAULT 'csv' NOT NULL,
  "filters" jsonb NOT NULL,
  "filters_hash" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "phase" text,
  "progress" integer DEFAULT 0 NOT NULL,
  "total_rows" integer,
  "processed_rows" integer,
  "s3_key" text,
  "file_size_bytes" integer,
  "error_message" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "data_exports_user_id_created_at_idx" ON "data_exports" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "data_exports_status_idx" ON "data_exports" ("status");
CREATE INDEX IF NOT EXISTS "data_exports_filters_hash_idx" ON "data_exports" ("user_id", "filters_hash");
