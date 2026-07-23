CREATE TABLE IF NOT EXISTS "domain_event_delivery" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "consumer" text NOT NULL,
  "event_id" bigint NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "lease_expires_at" timestamp with time zone,
  "next_retry_at" timestamp with time zone,
  "idempotency_key" text,
  "provider_reference" text,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "domain_event_delivery_consumer_event_id_unique" UNIQUE("consumer", "event_id"),
  CONSTRAINT "domain_event_delivery_event_id_domain_events_id_fk"
    FOREIGN KEY ("event_id") REFERENCES "public"."domain_events"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "domain_event_delivery_status_next_retry_idx"
  ON "domain_event_delivery" ("status", "next_retry_at");

CREATE INDEX IF NOT EXISTS "domain_event_delivery_status_idx"
  ON "domain_event_delivery" ("status");

CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_bid_first_for_user_uid"
  ON "domain_events" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'bid.first_for_user';

CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_bid_outbid_uid"
  ON "domain_events" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'bid.outbid';

CREATE UNIQUE INDEX IF NOT EXISTS "domain_events_user_linked_external_uid"
  ON "domain_events" ("aggregate_type", "aggregate_id")
  WHERE event_type = 'user.linked_external';
