CREATE TABLE IF NOT EXISTS "ssf_stream" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "receiver_id" text NOT NULL,
  "audience" text NOT NULL,
  "endpoint" text NOT NULL,
  "status" text NOT NULL DEFAULT 'disabled',
  "events_requested" jsonb NOT NULL,
  "events_delivered" jsonb NOT NULL,
  "signing_algorithm" text NOT NULL DEFAULT 'RS256',
  "signing_kid" text,
  "last_mapped_event_id" bigint NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ssf_stream_status_check" CHECK ("status" IN ('enabled', 'paused', 'disabled')),
  CONSTRAINT "ssf_stream_endpoint_https_check" CHECK ("endpoint" LIKE 'https://%' OR "endpoint" LIKE 'http://localhost:%'),
  CONSTRAINT "ssf_stream_signing_algorithm_check" CHECK ("signing_algorithm" = 'RS256')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ssf_stream_client_receiver_uid" ON "ssf_stream" ("client_id", "receiver_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssf_stream_status_idx" ON "ssf_stream" ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ssf_delivery" (
  "id" text PRIMARY KEY NOT NULL,
  "stream_id" text NOT NULL REFERENCES "ssf_stream"("id") ON DELETE CASCADE,
  "source_event_id" bigint REFERENCES "domain_events"("id") ON DELETE RESTRICT,
  "event_type" text NOT NULL,
  "jti" text NOT NULL,
  "txn" text,
  "signing_kid" text NOT NULL,
  "signing_algorithm" text NOT NULL DEFAULT 'RS256',
  "set_token" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone NOT NULL DEFAULT now(),
  "claimed_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "last_status_code" integer,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "ssf_delivery_status_check" CHECK ("status" IN ('pending', 'delivering', 'delivered', 'failed')),
  CONSTRAINT "ssf_delivery_signing_algorithm_check" CHECK ("signing_algorithm" = 'RS256'),
  CONSTRAINT "ssf_delivery_attempt_count_check" CHECK ("attempt_count" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ssf_delivery_jti_uid" ON "ssf_delivery" ("jti");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ssf_delivery_stream_source_uid"
  ON "ssf_delivery" ("stream_id", "source_event_id")
  WHERE "source_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssf_delivery_due_idx" ON "ssf_delivery" ("status", "next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssf_delivery_claimed_idx" ON "ssf_delivery" ("status", "claimed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ssf_delivery_retention_idx"
  ON "ssf_delivery" ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bid_ssf_replay" (
  "jti" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_ssf_replay_expires_idx" ON "bid_ssf_replay" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_ssf_replay" (
  "jti" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_ssf_replay_expires_idx" ON "shop_ssf_replay" ("expires_at");
