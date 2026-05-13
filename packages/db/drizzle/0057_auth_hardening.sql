-- Auth go-live hardening: case-insensitive email uniqueness, account (user, provider) uniqueness,
-- verification lookup indexes, pending-email uniqueness, step-up auth column on session.
-- Fails fast if duplicate logical emails or duplicate (user_id, provider_id) rows exist — run
-- `pnpm exec tsx packages/db/scripts/report-email-collisions.ts` first.

--> statement-breakpoint
DO $$
DECLARE
  dup_emails int;
  dup_pending int;
  dup_accounts int;
BEGIN
  SELECT count(*) INTO dup_emails FROM (
    SELECT lower(trim(email)) AS e FROM "user" GROUP BY lower(trim(email)) HAVING count(*) > 1
  ) t;
  IF dup_emails > 0 THEN
    RAISE EXCEPTION '0057_auth_hardening: % duplicate logical email(s) after lower(trim) — resolve before migrating (see packages/db/scripts/report-email-collisions.ts)', dup_emails;
  END IF;

  SELECT count(*) INTO dup_pending FROM (
    SELECT lower(trim(pending_new_email)) AS p
    FROM "user"
    WHERE pending_new_email IS NOT NULL
    GROUP BY lower(trim(pending_new_email))
    HAVING count(*) > 1
  ) tp;
  IF dup_pending > 0 THEN
    RAISE EXCEPTION '0057_auth_hardening: % duplicate in-flight pending_new_email — resolve before migrating', dup_pending;
  END IF;

  SELECT count(*) INTO dup_accounts FROM (
    SELECT user_id, provider_id FROM account GROUP BY user_id, provider_id HAVING count(*) > 1
  ) t2;
  IF dup_accounts > 0 THEN
    RAISE EXCEPTION '0057_auth_hardening: duplicate (user_id, provider_id) in account — resolve before migrating';
  END IF;
END $$;

--> statement-breakpoint
UPDATE "user" SET email = lower(trim(email));

--> statement-breakpoint
UPDATE "user" SET pending_new_email = lower(trim(pending_new_email)) WHERE pending_new_email IS NOT NULL;

--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_email_unique";

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_lower_uidx" ON "user" ((lower(trim("email"))));

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_pending_new_email_lower_uidx" ON "user" ((lower(trim("pending_new_email")))) WHERE "pending_new_email" IS NOT NULL;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "account_user_id_provider_id_uidx" ON "account" ("user_id", "provider_id");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verification_expires_at_idx" ON "verification" ("expires_at");

--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "last_password_auth_at" timestamp with time zone;
