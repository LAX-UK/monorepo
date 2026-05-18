CREATE TABLE IF NOT EXISTS "marketing_event_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" text NOT NULL,
  "name" text NOT NULL,
  "payload" jsonb NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "sent_at" timestamp with time zone,
  CONSTRAINT "marketing_event_outbox_event_id_unique" UNIQUE("event_id")
);

CREATE INDEX IF NOT EXISTS "marketing_event_outbox_state_created_idx"
  ON "marketing_event_outbox" ("state", "created_at");
