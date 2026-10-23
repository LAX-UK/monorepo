-- Restores the previous scrub function, then drops the address book. Bid's "user_address" was
-- never modified by the forward migration, so addresses created before the switch-over are
-- intact; addresses created in the address book afterwards are lost with the table.
CREATE OR REPLACE FUNCTION public.user_pii_purge(p_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public."user" SET
    name = '[deleted]',
    email = 'deleted+' || p_user_id || '@purged.invalid',
    image = NULL,
    pending_new_email = NULL,
    email_change_old_ok = false,
    email_change_new_ok = false,
    email_change_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;

DROP TABLE IF EXISTS "identity_address";
