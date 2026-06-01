DO $$ BEGIN
  CREATE TYPE "aml_triage_recommendation" AS ENUM ('recommend_clear', 'recommend_block');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "kyc_watchlist_screening"
  ADD COLUMN IF NOT EXISTS "triage_recommendation" "aml_triage_recommendation";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening"
  ADD COLUMN IF NOT EXISTS "triaged_by_user_id" text;--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening"
  ADD COLUMN IF NOT EXISTS "triaged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening"
  ADD COLUMN IF NOT EXISTS "triage_notes" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "kyc_watchlist_screening"
    ADD CONSTRAINT "kyc_watchlist_screening_triaged_by_user_id_user_id_fk"
    FOREIGN KEY ("triaged_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "source_of_funds_triage_recommendation" AS ENUM ('recommend_approve', 'recommend_reject');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "source_of_funds"
  ADD COLUMN IF NOT EXISTS "triage_recommendation" "source_of_funds_triage_recommendation";--> statement-breakpoint
ALTER TABLE "source_of_funds"
  ADD COLUMN IF NOT EXISTS "triaged_by_user_id" text;--> statement-breakpoint
ALTER TABLE "source_of_funds"
  ADD COLUMN IF NOT EXISTS "triaged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "source_of_funds"
  ADD COLUMN IF NOT EXISTS "triage_notes" text;--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "source_of_funds"
    ADD CONSTRAINT "source_of_funds_triaged_by_user_id_user_id_fk"
    FOREIGN KEY ("triaged_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
