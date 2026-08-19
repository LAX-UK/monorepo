-- Restore the pre-0153 function body for a migration rollback.
CREATE OR REPLACE FUNCTION public.user_pii_purge(p_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public."user" SET
    name = '[deleted]',
    email = 'deleted+' || p_user_id || '@purged.invalid',
    first_name = NULL,
    last_name = NULL,
    mobile = NULL,
    image = NULL,
    pending_new_email = NULL,
    email_change_old_ok = false,
    email_change_new_ok = false,
    email_change_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;
END;
$$;
