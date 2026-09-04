-- Restore the staged source-table read if API code must roll back before the
-- identity directory cutover is complete.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    GRANT SELECT ON TABLE public."user" TO api_app;
  END IF;
END;
$$;
