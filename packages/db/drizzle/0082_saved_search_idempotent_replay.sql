-- Idempotent replay of 0077 for databases that applied later migrations before 0077 was
-- registered in drizzle/meta/_journal.json.

CREATE TABLE IF NOT EXISTS "saved_search" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"query" jsonb NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_search_user_id_user_id_fk'
  ) THEN
    ALTER TABLE "saved_search" ADD CONSTRAINT "saved_search_user_id_user_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_search_user_id_idx" ON "saved_search" ("user_id");
