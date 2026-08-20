-- Apply only after the identity-directory projector is deployed, caught up, and
-- all worker readers use public.bid_identity_directory.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_app') THEN
    REVOKE SELECT ON TABLE public."user" FROM worker_app;
  END IF;
END;
$$;
