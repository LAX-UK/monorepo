-- Apply only after API, persistence, and export readers use
-- public.bid_identity_directory and authoritative security reads use apps/auth.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    REVOKE SELECT ON TABLE public."user" FROM api_app;
  END IF;
END;
$$;
