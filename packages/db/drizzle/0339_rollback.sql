-- Rollback for 0339_sign_in_methods_data. Roll back the application release first: the previous
-- release does not read these columns or the passkey table. Passkeys, the provider addresses and
-- the recorded sign-in methods are lost (a person re-adds a passkey; nothing else depends on them).
-- The scrub function goes back to the version from 0226.
BEGIN;

SET LOCAL lock_timeout = '5s';

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
  DELETE FROM public."account" WHERE user_id = p_user_id;
  DELETE FROM public."two_factor" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_access_token" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_consent" WHERE user_id = p_user_id;
  DELETE FROM public."auth_known_device" WHERE user_id = p_user_id;
END;
$$;

ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_amr_ck";
ALTER TABLE "session" DROP COLUMN IF EXISTS "amr";
ALTER TABLE "account"
  DROP COLUMN IF EXISTS "provider_email_hidden",
  DROP COLUMN IF EXISTS "provider_email";
DROP TRIGGER IF EXISTS "passkey_cap_trg" ON "passkey";
DROP FUNCTION IF EXISTS public.passkey_enforce_cap();
DROP TABLE IF EXISTS "passkey";

COMMIT;
