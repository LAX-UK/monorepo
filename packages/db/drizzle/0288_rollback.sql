-- Rollback for 0288_zoho_artwork_sync. Roll back the application release first: the previous
-- release neither reads nor writes these tables. The watermark and the reports are lost; the next
-- pass starts from the beginning and the Zoho Products are untouched.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "zoho_artwork_sync_outcome";
DROP TABLE IF EXISTS "zoho_artwork_sync_state";
