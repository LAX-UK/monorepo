DO $$ BEGIN
  CREATE TYPE "source_of_funds_status" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "source_of_funds_trigger" AS ENUM ('threshold', 'linked_transactions', 'risk_indicator', 'manual');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "source_of_funds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "status" "source_of_funds_status" DEFAULT 'pending' NOT NULL,
  "trigger" "source_of_funds_trigger" NOT NULL,
  "threshold_amount" numeric(18, 2) NOT NULL,
  "exposure_amount" numeric(18, 2) NOT NULL,
  "currency" text DEFAULT 'GBP' NOT NULL,
  "declared_source" text,
  "evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reviewed_by_user_id" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "source_of_funds_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "source_of_funds_reviewed_by_user_id_user_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "source_of_funds_user_id_idx" ON "source_of_funds" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_of_funds_status_idx" ON "source_of_funds" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "source_of_funds_user_status_idx" ON "source_of_funds" ("user_id", "status");
