ALTER TABLE "source_of_funds"
  DROP CONSTRAINT IF EXISTS "source_of_funds_triaged_by_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "source_of_funds" DROP COLUMN IF EXISTS "triage_notes";--> statement-breakpoint
ALTER TABLE "source_of_funds" DROP COLUMN IF EXISTS "triaged_at";--> statement-breakpoint
ALTER TABLE "source_of_funds" DROP COLUMN IF EXISTS "triaged_by_user_id";--> statement-breakpoint
ALTER TABLE "source_of_funds" DROP COLUMN IF EXISTS "triage_recommendation";--> statement-breakpoint
DROP TYPE IF EXISTS "source_of_funds_triage_recommendation";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening"
  DROP CONSTRAINT IF EXISTS "kyc_watchlist_screening_triaged_by_user_id_user_id_fk";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening" DROP COLUMN IF EXISTS "triage_notes";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening" DROP COLUMN IF EXISTS "triaged_at";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening" DROP COLUMN IF EXISTS "triaged_by_user_id";--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening" DROP COLUMN IF EXISTS "triage_recommendation";--> statement-breakpoint
DROP TYPE IF EXISTS "aml_triage_recommendation";
