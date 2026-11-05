-- Rollback for 0308_subject_legal_acceptance. Roll back the application release first: the
-- previous release neither reads nor writes this table. The record of which Terms and Privacy
-- notice each person accepted at sign-up is lost, so export it first if it is still needed.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "subject_legal_acceptance";
