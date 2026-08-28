ALTER TABLE "oauth_application"
  ADD COLUMN IF NOT EXISTS "backchannel_logout_uri" text;
--> statement-breakpoint
ALTER TABLE "oauth_application"
  ADD COLUMN IF NOT EXISTS "backchannel_logout_session_required" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "mfa_completed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "last_step_up_at" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oidc_rp_session" (
  "client_id" text NOT NULL,
  "subject_id" text NOT NULL,
  "sid" text NOT NULL,
  "identity_session_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "last_seen_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "oidc_rp_session_client_sid_pk" PRIMARY KEY ("client_id", "sid"),
  CONSTRAINT "oidc_rp_session_client_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE CASCADE,
  CONSTRAINT "oidc_rp_session_subject_id_fk"
    FOREIGN KEY ("subject_id") REFERENCES "user"("id") ON DELETE CASCADE,
  CONSTRAINT "oidc_rp_session_identity_session_id_fk"
    FOREIGN KEY ("identity_session_id") REFERENCES "session"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_rp_session_identity_session_idx"
  ON "oidc_rp_session" ("identity_session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_rp_session_subject_id_idx"
  ON "oidc_rp_session" ("subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_rp_session_subject_client_idx"
  ON "oidc_rp_session" ("subject_id", "client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_rp_session_revoked_retention_idx"
  ON "oidc_rp_session" ("revoked_at")
  WHERE "revoked_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_rp_session_active_last_seen_idx"
  ON "oidc_rp_session" ("last_seen_at")
  WHERE "revoked_at" IS NULL;
