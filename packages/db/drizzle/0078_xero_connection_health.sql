DO $$ BEGIN
  CREATE TYPE "xero_connection_status" AS ENUM ('healthy', 'needs_reauth');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "connection_status" "xero_connection_status" NOT NULL DEFAULT 'healthy';
ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "last_refresh_error" text;
ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "org_short_code" text;
ALTER TABLE "xero_connection" ADD COLUMN IF NOT EXISTS "org_base_currency" text;
