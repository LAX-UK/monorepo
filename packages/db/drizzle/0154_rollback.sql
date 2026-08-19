-- Restore the pre-0154 direct email enqueue grants for an auth code rollback.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_app') THEN
    GRANT INSERT, SELECT ON TABLE public.email_outbox TO auth_app;
    GRANT SELECT ON TABLE public.email_suppression TO auth_app;
  END IF;
END;
$$;
