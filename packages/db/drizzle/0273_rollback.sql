-- Rollback for 0273_subject_data_request. Roll back the application release first: the previous
-- release neither reads nor writes these tables. Every manual data request, its audit trail and
-- the link from a continued download are lost, so export them first if any request is still open.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "subject_data_request_audit";
DROP TABLE IF EXISTS "subject_data_request";
DROP SEQUENCE IF EXISTS "subject_data_request_reference_seq";
