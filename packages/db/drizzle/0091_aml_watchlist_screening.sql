ALTER TYPE "user_staff_role" ADD VALUE IF NOT EXISTS 'compliance_officer';--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "user_aml_hold_status" AS ENUM ('none', 'hold', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "aml_match_status" AS ENUM ('no_match', 'possible_match', 'confirmed_match', 'false_positive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "aml_monitor_status" AS ENUM ('not_monitored', 'monitored', 'monitoring_paused');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "aml_decision_outcome" AS ENUM ('clear', 'review', 'block');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "aml_review_status" AS ENUM ('not_required', 'pending', 'cleared', 'blocked');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "aml_hold_status" "user_aml_hold_status" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "aml_hold_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "aml_hold_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "kyc_watchlist_screening" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "provider" text DEFAULT 'veriff' NOT NULL,
  "provider_session_id" text NOT NULL,
  "match_status" "aml_match_status" NOT NULL,
  "monitor_status" "aml_monitor_status" DEFAULT 'not_monitored' NOT NULL,
  "total_hits" integer DEFAULT 0 NOT NULL,
  "categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "decision_outcome" "aml_decision_outcome" NOT NULL,
  "review_status" "aml_review_status" DEFAULT 'not_required' NOT NULL,
  "reviewed_by_user_id" text,
  "reviewed_at" timestamp with time zone,
  "review_notes" text,
  "payload" jsonb,
  "screened_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "kyc_watchlist_screening_provider_session_id_unique" UNIQUE ("provider_session_id"),
  CONSTRAINT "kyc_watchlist_screening_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "kyc_watchlist_screening_reviewed_by_user_id_user_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "kyc_watchlist_screening_user_id_idx" ON "kyc_watchlist_screening" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_watchlist_screening_review_status_idx" ON "kyc_watchlist_screening" ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "kyc_watchlist_screening_decision_outcome_idx" ON "kyc_watchlist_screening" ("decision_outcome");
