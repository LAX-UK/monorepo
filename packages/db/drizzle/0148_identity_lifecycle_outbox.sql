CREATE TABLE IF NOT EXISTS "identity_lifecycle_outbox" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "aggregate_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "producer" text NOT NULL,
  "actor_user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "correlation_id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "schema_version" integer NOT NULL DEFAULT 1,
  "occurred_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_lifecycle_outbox_event_type_idx"
  ON "identity_lifecycle_outbox" ("event_type");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_lifecycle_outbox_aggregate_idx"
  ON "identity_lifecycle_outbox" ("aggregate_type", "aggregate_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_lifecycle_outbox_occurred_at_idx"
  ON "identity_lifecycle_outbox" ("occurred_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_lifecycle_outbox_user_email_verified_uid"
  ON "identity_lifecycle_outbox" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'user.email_verified';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_lifecycle_outbox_user_registered_uid"
  ON "identity_lifecycle_outbox" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'user.registered';
