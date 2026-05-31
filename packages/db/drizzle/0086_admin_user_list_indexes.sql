CREATE INDEX IF NOT EXISTS "user_kyc_status_idx" ON "user" ("kyc_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_verified_idx" ON "user" ("email_verified");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_created_at_idx" ON "user" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_updated_at_idx" ON "user" ("updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_signup_persona_idx" ON "user" ("signup_persona");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_email_status_idx" ON "user" ("email_status");
