DO $$
BEGIN
  IF
    to_regclass('public.bid_identity_directory') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_app')
  THEN
    REVOKE ALL PRIVILEGES ON TABLE public.bid_identity_directory FROM worker_app;
  END IF;
  IF
    to_regclass('public.bid_identity_directory') IS NOT NULL
    AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app')
  THEN
    REVOKE ALL PRIVILEGES ON TABLE public.bid_identity_directory FROM api_app;
  END IF;
END;
$$;
--> statement-breakpoint
DROP TABLE IF EXISTS "bid_identity_directory";
