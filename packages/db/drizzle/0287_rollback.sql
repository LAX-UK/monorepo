-- Rollback for 0287_artwork_register. Roll back the application release first: the previous
-- release neither reads nor writes these tables. Every register record, its history and any open
-- conflict are lost; the Zoho Products they mirror are untouched and can be read in again.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "artwork_register_conflict";
DROP TABLE IF EXISTS "artwork_register_event";
DROP FUNCTION IF EXISTS artwork_register_event_append_only();
DROP TABLE IF EXISTS "artwork_register";
