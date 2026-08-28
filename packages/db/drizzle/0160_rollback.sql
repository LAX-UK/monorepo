-- Restore the staged source-table read if worker code must roll back before the
-- identity directory cutover is complete.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_app') THEN
    GRANT SELECT ON TABLE public."user" TO worker_app;
  END IF;
END;
$$;
