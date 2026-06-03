CREATE TABLE IF NOT EXISTS "marketing_contact_sync_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "provider" text NOT NULL,
  "action" text NOT NULL,
  "status" text NOT NULL,
  "reason" text,
  "provider_contact_id" text,
  "response_code" integer,
  "error" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_contact_sync_log_user_id_idx" ON "marketing_contact_sync_log" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_contact_sync_log_status_created_at_idx" ON "marketing_contact_sync_log" ("status","created_at");
