DROP TABLE IF EXISTS "oidc_rp_session";
--> statement-breakpoint
ALTER TABLE "session"
  DROP COLUMN IF EXISTS "last_step_up_at";
--> statement-breakpoint
ALTER TABLE "session"
  DROP COLUMN IF EXISTS "mfa_completed_at";
--> statement-breakpoint
ALTER TABLE "oauth_application"
  DROP COLUMN IF EXISTS "backchannel_logout_session_required";
--> statement-breakpoint
ALTER TABLE "oauth_application"
  DROP COLUMN IF EXISTS "backchannel_logout_uri";
