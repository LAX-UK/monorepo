ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_gender" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_nationality" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_citizenship" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_place_of_birth" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_year_of_birth" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_id_number" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_doc_state" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "verified_id_valid_from" date;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "decision_risk_score" text;
--> statement-breakpoint
ALTER TABLE "kyc_verification" ADD COLUMN IF NOT EXISTS "decision_ip_country" text;
