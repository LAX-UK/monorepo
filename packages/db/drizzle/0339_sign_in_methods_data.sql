-- Data behind the sign-in methods in LAX Account: passkeys, the address a linked provider reports,
-- and how each session was signed in. No sign-in flow reads or writes these yet; the issuer starts
-- using them in later releases, so running services keep working.
--
-- passkey:           one row per passkey, the shape Better Auth's passkey plugin expects, plus
--                    last_used_at. At most 10 per person, enforced here so no code path can
--                    exceed it. The public key and credential id never leave the issuer.
-- account columns:   the address the provider reported (sealed by the issuer like other personal
--                    fields, so it is opaque text here) and whether it is a private relay address.
-- session.amr:       how the session was signed in, from a fixed list.
-- user_pii_purge:    now also deletes a person's passkeys. The user row stays (anonymised), so the
--                    cascade would not remove them.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "passkey" (
  "id" text PRIMARY KEY,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name" text,
  "public_key" text NOT NULL,
  "credential_id" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "device_type" text NOT NULL,
  "backed_up" boolean NOT NULL,
  "transports" text,
  "aaguid" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  CONSTRAINT "passkey_name_ck"
    CHECK ("name" IS NULL OR ("name" = btrim("name") AND length("name") BETWEEN 1 AND 60)),
  CONSTRAINT "passkey_counter_ck" CHECK ("counter" >= 0),
  CONSTRAINT "passkey_device_type_ck" CHECK ("device_type" IN ('singleDevice', 'multiDevice'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "passkey_credential_id_uidx" ON "passkey" ("credential_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "passkey_user_id_idx" ON "passkey" ("user_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.passkey_enforce_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Two passkeys added at once by the same person queue behind each other, so the count is exact.
  --
  -- This relies on READ COMMITTED, the default and what every issuer transaction runs at: the
  -- count below is a new statement taken after the lock is held, so it sees the previous
  -- inserter's committed row. Under REPEATABLE READ or SERIALIZABLE the snapshot would predate the
  -- lock and two inserts could both pass at nine; do not run passkey inserts at those levels.
  PERFORM pg_advisory_xact_lock(hashtextextended('passkey:' || NEW.user_id, 0));
  IF (SELECT count(*) FROM public."passkey" WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'passkey_limit' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "passkey_cap_trg" ON "passkey";
--> statement-breakpoint
CREATE TRIGGER "passkey_cap_trg" BEFORE INSERT ON "passkey"
  FOR EACH ROW EXECUTE FUNCTION public.passkey_enforce_cap();
--> statement-breakpoint
ALTER TABLE "account"
  ADD COLUMN IF NOT EXISTS "provider_email" text,
  ADD COLUMN IF NOT EXISTS "provider_email_hidden" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "session"
  ADD COLUMN IF NOT EXISTS "amr" text[] NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE "session"
  ADD CONSTRAINT "session_amr_ck"
    CHECK ("amr" <@ ARRAY['password', 'provider', 'passkey', 'link']::text[]);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.user_pii_purge(p_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_email text;
  v_pending_email text;
BEGIN
  SELECT email, pending_new_email INTO v_email, v_pending_email
  FROM public."user"
  WHERE id = p_user_id;

  -- One-time email links (verification, password reset, magic link) outlive the scrub otherwise.
  -- A reset token stores the user id as its value; the others carry the address.
  DELETE FROM public."verification"
  WHERE value = p_user_id
     OR (v_email IS NOT NULL AND (
          lower(identifier) = lower(v_email)
          OR position(lower(v_email) IN lower(value)) > 0
        ))
     OR (v_pending_email IS NOT NULL AND (
          lower(identifier) = lower(v_pending_email)
          OR position(lower(v_pending_email) IN lower(value)) > 0
        ));

  UPDATE public."user" SET
    name = '[deleted]',
    email = 'deleted+' || p_user_id || '@purged.invalid',
    image = NULL,
    phone_number = NULL,
    phone_number_verified = false,
    pending_new_email = NULL,
    email_change_old_ok = false,
    email_change_new_ok = false,
    email_change_expires_at = NULL,
    two_factor_enabled = false,
    updated_at = now()
  WHERE id = p_user_id;

  DELETE FROM public."identity_address" WHERE subject_id = p_user_id;
  DELETE FROM public."session" WHERE user_id = p_user_id;
  -- The linked accounts, with the address each provider reported, go with the row.
  DELETE FROM public."account" WHERE user_id = p_user_id;
  DELETE FROM public."passkey" WHERE user_id = p_user_id;
  DELETE FROM public."two_factor" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_access_token" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_consent" WHERE user_id = p_user_id;
  DELETE FROM public."auth_known_device" WHERE user_id = p_user_id;
END;
$$;
