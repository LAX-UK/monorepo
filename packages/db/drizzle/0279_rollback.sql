-- Rollback for 0279_subject_data_export. Roll back the application release first: the previous
-- release neither reads nor writes these tables. Every data export request, its audit trail and
-- the record of which stored files still need deleting are lost, so delete any stored copies
-- first or they stay in the export bucket until its lifecycle rule removes them.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "subject_data_export_audit";
DROP TABLE IF EXISTS "subject_data_export";
