-- Rollback for 0348_sale_time_zone. Roll back the application release first: nothing reads the
-- column without it, and every sale is then quoted in London time as before. Zones staff chose for
-- non-London sales are lost.
BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE "sale" DROP CONSTRAINT IF EXISTS "sale_time_zone_names_a_place";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "time_zone";
ALTER TABLE "sale" DROP COLUMN IF EXISTS "first_published_at";

COMMIT;
