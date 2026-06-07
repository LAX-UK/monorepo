ALTER TABLE "kyc_watchlist_screening" ADD COLUMN IF NOT EXISTS "hits" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "kyc_watchlist_screening" ADD COLUMN IF NOT EXISTS "check_type" text;
