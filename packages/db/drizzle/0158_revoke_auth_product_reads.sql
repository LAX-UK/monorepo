-- Orphan-signup compensation now queries product usage through the authenticated
-- internal API. The Identity issuer no longer reads or updates product tables.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_app') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.bid_user_profile FROM auth_app;
    REVOKE ALL PRIVILEGES ON TABLE public.external_accounts FROM auth_app;
  END IF;
END;
$$;
