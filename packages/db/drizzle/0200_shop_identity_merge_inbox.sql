SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_identity_merge_inbox" (
  "event_id" bigint PRIMARY KEY REFERENCES "domain_events"("id") ON DELETE RESTRICT,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_identity_merge_inbox_status_check" CHECK (
    "status" IN ('pending', 'completed', 'dead', 'failed')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_identity_merge_inbox_status_created_idx"
  ON "shop_identity_merge_inbox" ("status", "created_at");
