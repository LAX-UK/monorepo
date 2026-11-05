-- Rollback for 0294_lot_artwork_register_link. Roll back the application release first. Lots lose
-- their link to the register; the register's offer state is untouched, so an offer recorded for a
-- lot stays until it is withdrawn there.
SET LOCAL lock_timeout = '30s';

DROP INDEX IF EXISTS "lot_artwork_register_id_idx";
ALTER TABLE "lot" DROP COLUMN IF EXISTS "artwork_register_id";
