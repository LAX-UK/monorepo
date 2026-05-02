-- Unified webhook inbox and domain events outbox

CREATE TABLE IF NOT EXISTS "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"event_key" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "webhook_event_event_key_unique" UNIQUE("event_key")
);

CREATE INDEX IF NOT EXISTS "webhook_event_source_idx" ON "webhook_event" USING btree ("source");
CREATE INDEX IF NOT EXISTS "webhook_event_processed_at_idx" ON "webhook_event" USING btree ("processed_at");

CREATE TABLE IF NOT EXISTS "domain_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"producer" text NOT NULL,
	"actor_user_id" text,
	"correlation_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "domain_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "domain_events_event_type_idx" ON "domain_events" USING btree ("event_type");
CREATE INDEX IF NOT EXISTS "domain_events_aggregate_idx" ON "domain_events" USING btree ("aggregate_type", "aggregate_id");
CREATE INDEX IF NOT EXISTS "domain_events_occurred_at_idx" ON "domain_events" USING btree ("occurred_at");

CREATE TABLE IF NOT EXISTS "projector_state" (
	"projector_name" text PRIMARY KEY NOT NULL,
	"last_processed_event_id" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text
);
