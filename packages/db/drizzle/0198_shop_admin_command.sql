SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "shop_admin_command_status" AS ENUM ('in_flight', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_admin_command" (
  "command_type" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_hash" text NOT NULL,
  "actor_subject_id" text NOT NULL,
  "status" "shop_admin_command_status" NOT NULL DEFAULT 'in_flight',
  "result_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  CONSTRAINT "shop_admin_command_pkey" PRIMARY KEY ("command_type", "idempotency_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_admin_command_created_at_idx"
  ON "shop_admin_command" ("created_at");
