-- Restore the pre-0155 direct product usage probe grants for an auth code rollback.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_app') THEN
    GRANT SELECT ON TABLE public.bid_user_profile TO auth_app;
    GRANT SELECT, UPDATE ON TABLE public.external_accounts TO auth_app;
  END IF;
END;
$$;
