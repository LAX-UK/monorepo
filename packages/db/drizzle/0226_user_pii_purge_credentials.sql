-- Account deletion must erase everything that identifies or authenticates the person, not only
-- the profile fields. The scrub already cleared name, email, image, pending email and the address
-- book; it left the phone number, the password hash and social links, the two-step secret and
-- backup codes, live sessions and OAuth tokens and consents in place.
--
-- The "user" row itself stays, anonymised, so foreign keys from orders, invoices and payments
-- (kept for legal and accounting reasons) remain valid. Only the person's own sign-in material
-- is deleted. Back-channel logout deliveries and RP session rows hold no personal data and are
-- left for the issuer to finish telling each product the person is signed out.
--
-- Function replacement only: no schema change, and the running services keep working.
SET LOCAL lock_timeout = '30s';
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
  DELETE FROM public."account" WHERE user_id = p_user_id;
  DELETE FROM public."two_factor" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_access_token" WHERE user_id = p_user_id;
  DELETE FROM public."oauth_consent" WHERE user_id = p_user_id;
  DELETE FROM public."auth_known_device" WHERE user_id = p_user_id;
END;
$$;
