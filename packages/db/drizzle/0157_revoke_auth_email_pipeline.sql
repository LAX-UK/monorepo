-- Identity email intents now cross the authenticated API boundary. The issuer
-- no longer reads or writes the product-owned email pipeline directly.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_app') THEN
    REVOKE ALL PRIVILEGES ON TABLE public.email_outbox FROM auth_app;
    REVOKE ALL PRIVILEGES ON TABLE public.email_suppression FROM auth_app;
  END IF;
END;
$$;
