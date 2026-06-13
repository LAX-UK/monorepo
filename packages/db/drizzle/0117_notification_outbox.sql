CREATE TABLE IF NOT EXISTS "notification_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "idempotency_key" text NOT NULL,
  "user_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "processed_at" timestamp with time zone,
  "claimed_at" timestamp with time zone,
  CONSTRAINT "notification_outbox_idempotency_key_unique" UNIQUE("idempotency_key"),
  CONSTRAINT "notification_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action
);

CREATE INDEX IF NOT EXISTS "notification_outbox_state_created_idx"
  ON "notification_outbox" ("state", "created_at");

CREATE INDEX IF NOT EXISTS "notification_outbox_user_id_idx"
  ON "notification_outbox" ("user_id");
