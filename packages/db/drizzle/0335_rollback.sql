-- Rollback for 0335_collection_visit_cap. Roll back the application release first: the previous
-- release does not read the cap, so visits are then limited only by the places in each time.
BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE "collection_place" DROP CONSTRAINT IF EXISTS "collection_place_visit_cap_check";
ALTER TABLE "collection_place" DROP COLUMN IF EXISTS "max_active_visits";

COMMIT;
