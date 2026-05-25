ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "org_base_currency";
ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "org_short_code";
ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "last_refresh_error";
ALTER TABLE "xero_connection" DROP COLUMN IF EXISTS "connection_status";
DROP TYPE IF EXISTS "xero_connection_status";
