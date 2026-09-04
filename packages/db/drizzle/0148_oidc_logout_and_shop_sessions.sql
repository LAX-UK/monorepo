CREATE TABLE IF NOT EXISTS "oidc_backchannel_logout_delivery" (
  "id" text PRIMARY KEY NOT NULL,
  "event_key" text NOT NULL UNIQUE,
  "client_id" text NOT NULL REFERENCES "oauth_application"("client_id") ON DELETE CASCADE,
  "subject_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "sid" text,
  "token_jti" text NOT NULL,
  "token_iat" integer NOT NULL,
  "endpoint" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamp with time zone NOT NULL,
  "claimed_at" timestamp with time zone,
  "delivered_at" timestamp with time zone,
  "last_status_code" integer,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  CONSTRAINT "oidc_backchannel_logout_status_check"
    CHECK ("status" IN ('pending', 'delivering', 'delivered', 'failed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_backchannel_logout_due_idx"
  ON "oidc_backchannel_logout_delivery" ("status", "next_attempt_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_backchannel_logout_subject_idx"
  ON "oidc_backchannel_logout_delivery" ("subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oidc_backchannel_logout_retention_idx"
  ON "oidc_backchannel_logout_delivery" ("status", "updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_identity_session" (
  "id" text PRIMARY KEY NOT NULL,
  "subject_id" text,
  "sid" text,
  "id_token" text,
  "oauth_state" text,
  "oauth_nonce" text,
  "oauth_code_verifier" text,
  "expires_at" timestamp with time zone NOT NULL,
  "invalidated_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_identity_session_sid_idx" ON "shop_identity_session" ("sid");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_identity_session_subject_idx" ON "shop_identity_session" ("subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_identity_session_expires_idx"
  ON "shop_identity_session" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_logout_token_replay" (
  "jti" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_logout_token_replay_expires_idx"
  ON "shop_logout_token_replay" ("expires_at");
