-- Security notification emails and durable security side effects, both owned by the auth issuer.
--
-- auth_known_device remembers which browsers a person has signed in from (as a hash, never a user
-- agent string or an IP address) so only a device unseen for 90 days triggers a "new sign-in" email.
-- auth_security_effect_outbox holds session and token revocations that failed after the change
-- that required them had committed, so the issuer's worker can retry them across restarts.
-- Additive: the running issuer does not touch either table until it is deployed.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_known_device" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "fingerprint" text NOT NULL,
  "first_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_seen_at" timestamp with time zone NOT NULL DEFAULT now(),
  "notified_at" timestamp with time zone,
  PRIMARY KEY ("user_id", "fingerprint")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_known_device_user_notified_idx"
  ON "auth_known_device" ("user_id", "notified_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_security_effect_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "user_id" text,
  "status" text NOT NULL DEFAULT 'pending',
  "attempt_count" integer NOT NULL DEFAULT 1,
  "next_attempt_at" timestamp with time zone NOT NULL,
  "claimed_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_security_effect_outbox_due_idx"
  ON "auth_security_effect_outbox" ("status", "next_attempt_at");
